'use strict';
'require view';
'require fs';
'require ui';

return view.extend({
	load: function() {
		return fs.exec('/usr/sbin/mt5700m-at', [ 'status' ]).catch(function(err) {
			return { stdout: '', stderr: err.message || String(err) };
		});
	},

	parseStatus: function(res) {
		var data = {};

		(res.stdout || '').trim().split(/\n/).forEach(function(line) {
			var pos = line.indexOf('=');

			if (pos > -1)
				data[line.substring(0, pos)] = line.substring(pos + 1);
		});

		data.error = res.stderr || '';
		return data;
	},

	styleNode: function() {
		return E('style', {}, [
			'.mt5700m-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin-bottom:16px}',
			'.mt5700m-card{border:1px solid var(--border-color-medium,#d8d8d8);border-radius:8px;padding:12px;background:var(--background-color-high,#fff);min-height:76px}',
			'.mt5700m-card-title{font-size:12px;color:var(--text-color-medium,#666);margin-bottom:6px}',
			'.mt5700m-card-value{font-size:20px;line-height:1.25;font-weight:600;color:var(--text-color-high,#222);word-break:break-word}',
			'.mt5700m-card-hint{font-size:11px;color:var(--text-color-low,#888);margin-top:6px;word-break:break-word}',
			'.mt5700m-actions{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0 18px}',
			'.mt5700m-raw{white-space:pre-wrap;word-break:break-word;background:#16191d;color:#d7dde5;border-radius:6px;padding:12px;min-height:120px}'
		].join(''));
	},

	card: function(title, value, hint) {
		return E('div', { 'class': 'mt5700m-card' }, [
			E('div', { 'class': 'mt5700m-card-title' }, title),
			E('div', { 'class': 'mt5700m-card-value' }, value || _('Unknown')),
			hint ? E('div', { 'class': 'mt5700m-card-hint' }, hint) : null
		]);
	},

	actionButton: function(label, command, confirmText) {
		return E('button', {
			'class': 'btn cbi-button',
			'click': function() {
				var run = function() {
					return fs.exec('/usr/sbin/mt5700m-at', command).then(function(res) {
						ui.addNotification(null, E('pre', {}, res.stdout || _('Command completed.')));
					}, function(err) {
						ui.addNotification(null, E('p', {}, err.message), 'danger');
					});
				};

				if (confirmText)
					return ui.showModal(_('Confirm Action'), [
						E('p', {}, confirmText),
						E('div', { 'class': 'right' }, [
							E('button', {
								'class': 'btn',
								'click': ui.hideModal
							}, _('Cancel')),
							' ',
							E('button', {
								'class': 'btn cbi-button-negative',
								'click': function() {
									ui.hideModal();
									run();
								}
							}, _('Continue'))
						])
					]);

				return run();
			}
		}, label);
	},

	render: function(res) {
		var data = this.parseStatus(res);
		var connected = data.connected === '1' ? _('Connected') : _('Disconnected');
		var connectedHint = '%s:%s'.format(data.host || '192.168.8.1', data.port || '20249');
		var signal = [];

		if (data.rsrp)
			signal.push('RSRP %s dBm'.format(data.rsrp));
		if (data.rsrq)
			signal.push('RSRQ %s dB'.format(data.rsrq));
		if (data.sinr)
			signal.push('SINR %s dB'.format(data.sinr));

		return E('div', {}, [
			this.styleNode(),
			E('h2', {}, _('MT5700M Management')),
			E('div', { 'class': 'cbi-section-descr' }, _('Native LuCI management page for the MT5700M module network AT interface.')),
			E('div', { 'class': 'mt5700m-grid' }, [
				this.card(_('Connection'), connected, connectedHint),
				this.card(_('Module'), data.model || data.manufacturer, data.revision || ''),
				this.card(_('SIM Status'), data.sim, data.imei ? 'IMEI ' + data.imei : ''),
				this.card(_('Operator'), data.operator, ''),
				this.card(_('Network Mode'), data.sysmode, signal.join(' / ')),
				this.card(_('Module Temperature'), data.temperature ? _('%s C').format(data.temperature) : '', 'AT^CHIPTEMP?'),
				this.card(_('NR Lock'), data.nr_lock || _('Unknown'), 'AT^NRFREQLOCK?'),
				this.card(_('LTE Lock'), data.lte_lock || _('Unknown'), 'AT^LTEFREQLOCK?')
			]),
			E('div', { 'class': 'mt5700m-actions' }, [
				this.actionButton(_('Refresh'), [ 'status' ]),
				this.actionButton(_('Unlock LTE/NR'), [ 'unlock' ], _('This will unlock LTE and NR frequency locks. QModem may redial after the modem changes state.')),
				this.actionButton(_('Restart Module'), [ 'restart' ], _('This will restart the MT5700M module and temporarily interrupt 5G connectivity.'))
			]),
			data.error ? E('div', { 'class': 'alert-message warning' }, data.error) : null
		]);
	}
});
