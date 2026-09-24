import { Property, RestApi } from '@servicenow/sdk/core'

// Placeholder only — the real TypeSafe key is set on the instance after the
// first install and must never be committed. 'once' keeps redeploys from
// overwriting it.
Property({
    $id: Now.ID['typesafe-api-key'],
    $meta: { installMethod: 'once' },
    name: 'x_snc_handwave.typesafe_api_key',
    type: 'string',
    value: 'REPLACE_WITH_TYPESAFE_API_KEY',
    description: 'TypeSafe (Jev) API key used by /api/x_snc_handwave/jev/retire. Set on instance only.',
    isPrivate: true,
    roles: { read: ['admin'], write: ['admin'] },
})

// Same call as jev's "Jev Decision Check (Script)" tool (AGL AICT and ADA/jev),
// fixed to the retire question. The browser sends only the governance facts;
// the key never leaves the server.
RestApi({
    $id: Now.ID['jev-api'],
    name: 'Handwave Jev',
    serviceId: 'jev',
    consumes: 'application/json',
    produces: 'application/json',
    routes: [
        {
            $id: Now.ID['jev-retire-route'],
            name: 'Retire decision',
            method: 'POST',
            path: '/retire',
            authentication: true,
            authorization: false,
            script: `(function process(request, response) {
  var body = (request.body && request.body.data) || {};
  var label = String(body.label || '').slice(0, 200);
  var state = String(body.state || '').slice(0, 2000);
  if (!label || !state) {
    response.setStatus(400);
    response.setBody({ error: 'label and state are required' });
    return;
  }
  var key = gs.getProperty('x_snc_handwave.typesafe_api_key', '');
  if (!key || key.indexOf('REPLACE_WITH') === 0) {
    response.setStatus(500);
    response.setBody({ error: 'x_snc_handwave.typesafe_api_key is not set' });
    return;
  }
  var rm = new sn_ws.RESTMessageV2();
  rm.setHttpMethod('POST');
  rm.setEndpoint('https://api.typesafe.ai/v1/systemone');
  rm.setRequestHeader('Authorization', 'Bearer ' + key);
  rm.setRequestHeader('Content-Type', 'application/json');
  rm.setHttpTimeout(20000);
  rm.setRequestBody(JSON.stringify({
    state: state,
    model: 'jev-latest',
    questions: { answer: { type: 'noul', instructions: 'Should the AI agent "' + label + '" be retired?' } }
  }));
  var res = rm.execute();
  var code = res.getStatusCode();
  try {
    var parsed = JSON.parse(res.getBody());
    var noul = parsed.answers.answer.noul;
    response.setBody({ retire: noul >= 0.5, probability: noul, model: parsed.model });
  } catch (e) {
    response.setStatus(502);
    response.setBody({ error: 'Jev call failed (HTTP ' + code + ')' });
  }
})(request, response);`,
        },
    ],
})
