import {html, css} from 'lit';
import {customElement} from 'lit/decorators.js';
import {
  AIUXWidgetElement,
  decorators
} from '@servicenow/aiux/aiux-components-core';
import {i18n} from '@servicenow/aiux/aiux-services';
const {
  name,
  description,
  bestFor,
  chatCompatible,
  category,
  server,
  discoverable
} = decorators;

@customElement('aiux-hello-world')
@name('Hello World')
@description('A simple greeting widget.')
@bestFor('Displaying a greeting on the home page.')
@chatCompatible(false)
@category('custom')
@server('./server-script.js')
@discoverable(true)
export default class HelloWorldWidget extends AIUXWidgetElement {
  static properties = {
    _greeting: {type: String, state: true}
  };

  static styles = css`
    :host {
      display: block;
    }
  `;

  constructor() {
    super();
    this._greeting = 'Hello from AIUX!';
  }

  render() {
    const greeting = this.data?.greeting || this._greeting;
    return html`
      <div class="flex flex-col items-center gap-4 p-8 text-center">
        <div class="text-4xl font-bold text-text-primary">${greeting}</div>
        <p class="text-sm text-text-tertiary">
          ${i18n.getMessage('Built with AIUX')}
        </p>
      </div>
    `;
  }
}
