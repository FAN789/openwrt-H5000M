'use strict';
'require view';
'require fs';
'require ui';

return view.extend({
	styleNode: function() {
		return E('style', {}, [
			'.mt5700m-terminal-row{display:flex;gap:8px;align-items:center;margin-bottom:12px}',
			'.mt5700m-terminal-row input{flex:1;font-family:monospace}',
			'.mt5700m-quick{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px}',
			'.mt5700m-output{white-space:pre-wrap;word-break:break-word;background:#16191d;color:#d7dde5;border-radius:6px;padding:12px;min-height:360px;max-height:560px;overflow:auto;font-family:monospace;font-size:13px}'
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
			E('h2', {}, _('MT5700M AT Terminal')),
			E('div', { 'class': 'cbi-section-descr' }, _('Send AT commands directly to the configured MT5700M network AT interface.')),
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
		]);
	}
});
