'use strict';
'require view';
'require fs';
'require ui';

return view.extend({
	styleNode: function() {
		return E('style', {}, [
			'.mt-terminal-hero{padding:22px 24px;border-radius:14px;background:linear-gradient(135deg,#202733,#313d4c);color:#fff;margin-bottom:16px}',
			'.mt-terminal-hero h2{color:#fff;margin:0 0 6px}.mt-terminal-hero p{color:#cbd2da;margin:0;max-width:760px}',
			'.mt-terminal-card{border:1px solid var(--border-color-low,#e4e8ec);border-radius:12px;background:var(--background-color-high,#fff);padding:18px}',
			'.mt-terminal-warning{padding:11px 13px;border-radius:8px;background:#fff7e5;color:#795300;font-size:12px;margin-bottom:14px}',
			'.mt5700m-terminal-row{display:flex;gap:8px;align-items:center;margin-bottom:14px}',
			'.mt5700m-terminal-row input{flex:1;font-family:monospace}',
			'.mt5700m-quick{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px}',
			'.mt5700m-output{white-space:pre-wrap;word-break:break-word;background:#111820;color:#d7e1ea;border-radius:9px;padding:15px;min-height:320px;max-height:560px;overflow:auto;font-family:monospace;font-size:13px;line-height:1.55}',
			'@media(max-width:680px){.mt5700m-terminal-row{flex-wrap:wrap}.mt5700m-terminal-row input{flex-basis:100%}.mt-terminal-hero{padding:20px}}'
		].join(''));
	},

	appendOutput: function(node, text, prefix) {
		var timestamp = new Date().toLocaleTimeString();

		node.textContent += '[%s] %s %s\n'.format(timestamp, prefix, text || '');
		node.scrollTop = node.scrollHeight;
	},

	sendCommand: function(output, input) {
		var cmd = (input.value || '').trim();
		var self = this;

		if (!cmd) {
			ui.addNotification(null, E('p', {}, _('Command is empty.')), 'warning');
			return;
		}

		this.appendOutput(output, cmd, '>>>');
		input.value = '';

		return fs.exec('/usr/sbin/mt5700m-at', [ 'command', cmd ]).then(function(res) {
			self.appendOutput(output, res.stdout || _('No response.'), '<<<');
			if (res.stderr)
				self.appendOutput(output, res.stderr, 'ERR');
		}, function(err) {
			self.appendOutput(output, err.message || String(err), 'ERR');
		});
	},

	quickButton: function(label, cmd, input, output) {
		var self = this;

		return E('button', {
			'class': 'btn cbi-button',
			'click': function() {
				input.value = cmd;
				self.sendCommand(output, input);
			}
		}, label);
	},

	render: function() {
		var input = E('input', {
			'type': 'text',
			'class': 'cbi-input-text',
			'placeholder': _('Enter AT command, for example AT^HCSQ?')
		});
		var output = E('pre', { 'class': 'mt5700m-output' }, _('Ready.'));
		var self = this;

		input.addEventListener('keydown', function(ev) {
			if (ev.key === 'Enter')
				self.sendCommand(output, input);
		});

		return E('div', {}, [
			this.styleNode(),
			E('section', { 'class': 'mt-terminal-hero' }, [ E('h2', {}, _('AT command console')), E('p', {}, _('Diagnostic console for advanced users. Commands are sent directly to the MT5700M and are not automatically validated.')) ]),
			E('section', { 'class': 'mt-terminal-card' }, [
			E('div', { 'class': 'mt-terminal-warning' }, _('Use query commands whenever possible. Configuration and reset commands may interrupt mobile connectivity.')),
			E('div', { 'class': 'mt5700m-terminal-row' }, [
				input,
				E('button', {
					'class': 'btn cbi-button-apply',
					'click': function() {
						self.sendCommand(output, input);
					}
				}, _('Send')),
				E('button', {
					'class': 'btn',
					'click': function() {
						output.textContent = '';
					}
				}, _('Clear'))
			]),
			E('div', { 'class': 'mt5700m-quick' }, [
				this.quickButton('AT', 'AT', input, output),
				this.quickButton('ATI', 'ATI', input, output),
				this.quickButton('SIM', 'AT+CPIN?', input, output),
				this.quickButton(_('Signal'), 'AT^HCSQ?', input, output),
				this.quickButton(_('Temperature'), 'AT^CHIPTEMP?', input, output),
				this.quickButton(_('Operator'), 'AT+COPS?', input, output),
				this.quickButton(_('Cell Info'), 'AT^MONSC', input, output),
				this.quickButton(_('NR Lock'), 'AT^NRFREQLOCK?', input, output),
				this.quickButton(_('LTE Lock'), 'AT^LTEFREQLOCK?', input, output)
			]),
			output
			])
		]);
	}
});
