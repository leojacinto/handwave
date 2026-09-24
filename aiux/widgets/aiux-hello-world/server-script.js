export default function server(data, _options, _input) {
  data.greeting = 'Hello from AIUX!';
  data.timestamp = new GlideDateTime().getDisplayValue();
}
