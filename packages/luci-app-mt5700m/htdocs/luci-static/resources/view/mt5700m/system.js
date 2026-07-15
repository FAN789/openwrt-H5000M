'use strict';
'require view';
'require fs';
'require ui';

function section(raw, label) {
	var marker = '===== ' + label + ':';
	var active = false;
	var output = [];
	(raw || '').split(/\n/).forEach(function(line) {
		if (line.indexOf('===== ') === 0) {
			active = line.indexOf(marker) === 0;
			return;
		}
		if (active && line.trim() && line.trim() !== 'OK')
			output.push(line.trim());
	});
	return output.join('\n');
}

function lineValue(text, prefix) {
	var line = (text || '').split(/\n/).filter(function(item) { return item.indexOf(prefix) === 0; })[0] || '';
	return line.substring(prefix.length).replace(/^[ :]+/, '').trim();
}

return view.extend({
	load: function() {
		return fs.exec('/usr/sbin/mt5700m-at', [ 'system' ]).catch(function(err) { return { stdout: '', stderr: err.message || String(err) }; });
	},

	styleNode: function() {
		return E('style', {}, [
			'.mt-system{max-width:1120px;margin:0 auto;color:var(--text-color-high,#20242a)}',
			'.mt-system-hero{display:flex;justify-content:space-between;align-items:center;gap:18px;padding:22px 24px;border-radius:15px;background:linear-gradient(135deg,#304667,#3b587d);color:#fff;margin-bottom:15px}',
			'.mt-system-kicker{font-size:12px;font-weight:700;opacity:.72;margin-bottom:5px}.mt-system-title{font-size:25px;font-weight:720;margin:0 0 6px;color:#fff}.mt-system-sub{font-size:13px;opacity:.8}',
			'.mt-system-temp{min-width:92px;text-align:center;padding:11px 14px;border-radius:12px;background:rgba(255,255,255,.12)}.mt-system-temp strong{display:block;font-size:24px}.mt-system-temp span{font-size:11px;opacity:.75}',
			'.mt-system-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.mt-system-card{padding:16px;border:1px solid var(--border-color-medium,#d9dde4);border-radius:13px;background:var(--background-color-high,#fff);box-shadow:0 3px 12px rgba(20,32,50,.04)}',
			'.mt-system-card h3{font-size:14px;margin:0 0 11px}.mt-system-row{display:flex;justify-content:space-between;gap:16px;padding:9px 0;border-bottom:1px solid var(--border-color-low,#edf0f4);font-size:12px}.mt-system-row:last-child{border-bottom:0}.mt-system-row span{color:var(--text-color-medium,#6e7783)}.mt-system-row strong{text-align:right;word-break:break-word}',
			'.mt-system-fota{margin-top:14px;padding:18px;border:1px solid #ead7b2;border-radius:13px;background:linear-gradient(135deg,#fffdf8,#fff9ec)}.mt-system-fota-head{display:flex;justify-content:space-between;align-items:flex-start;gap:15px}.mt-system-fota h3{font-size:16px;margin:0 0 5px}.mt-system-fota p{font-size:12px;color:#74664c;margin:0;line-height:1.5}',
			'.mt-system-state{padding:5px 10px;border-radius:999px;background:#edf1f7;color:#4e5d73;font-size:11px;font-weight:700;white-space:nowrap}.mt-system-state.active{background:#e0f5ed;color:#08775d}.mt-system-state.error{background:#fde7e3;color:#a43e2c}',
			'.mt-system-progress{height:8px;margin:16px 0 7px;border-radius:999px;background:#eadfc8;overflow:hidden}.mt-system-progress span{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#328df4,#15aa8d)}.mt-system-progress-label{font-size:11px;color:#7b6d52;text-align:right}',
			'.mt-system-url{display:grid;grid-template-columns:1fr auto;gap:9px;margin-top:14px}.mt-system-url input{width:100%;box-sizing:border-box}.mt-system-url .btn,.mt-system-actions .btn{border-radius:9px}',
			'.mt-system-actions{display:flex;flex-wrap:wrap;gap:9px;margin-top:14px}.mt-system-details{margin-top:14px;border:1px solid var(--border-color-medium,#d9dde4);border-radius:11px;overflow:hidden}.mt-system-details summary{cursor:pointer;padding:12px 14px;font-size:12px;font-weight:650}.mt-system-raw{margin:0;padding:14px;background:#17202a;color:#dce6ef;white-space:pre-wrap;word-break:break-word;font:11px/1.55 monospace;max-height:420px;overflow:auto}',
			'@media(max-width:720px){.mt-system-hero{align-items:flex-start}.mt-system-grid{grid-template-columns:1fr}.mt-system-url{grid-template-columns:1fr}.mt-system-url .btn{width:100%}}'
		].join(''));
	},

	row: function(label, value) {
		return E('div', { 'class': 'mt-system-row' }, [ E('span', {}, label), E('strong', {}, value || '--') ]);
	},

	runConfirmed: function(title, message, args, danger) {
		return ui.showModal(title, [
			E('p', {}, message),
			E('div', { 'class': 'right' }, [
				E('button', { 'class': 'btn', 'click': ui.hideModal }, _('Cancel')), ' ',
				E('button', { 'class': 'btn ' + (danger ? 'cbi-button-negative' : 'cbi-button-apply'), 'click': function() {
					ui.hideModal();
					fs.exec('/usr/sbin/mt5700m-at', args).then(function() {
						ui.addNotification(null, E('p', {}, _('Command accepted by the modem.')));
						window.setTimeout(function() { window.location.reload(); }, 1500);
					}, function(err) { ui.addNotification(null, E('p', {}, err.message || String(err)), 'danger'); });
				} }, _('Continue'))
			])
		]);
	},

	render: function(res) {
		var raw = res.stdout || '';
		var identity = section(raw, 'Identity');
		var version = section(raw, 'Version');
		var sim = lineValue(section(raw, 'SIM'), '+CPIN');
		var operatorValues = lineValue(section(raw, 'Operator'), '+COPS').replace(/"/g, '').split(',');
		var temperatureRaw = lineValue(section(raw, 'Temperature'), '^CHIPTEMP').split(',')[0];
		var temperature = /^-?\d+$/.test(temperatureRaw) ? (Number(temperatureRaw) / 10).toFixed(1) : '';
		var fotaMode = lineValue(section(raw, 'FOTA mode'), '^FOTAMODE');
		var fotaModeName = fotaMode === '0,1,0,1' ? _('HTTP update mode') : fotaMode;
		var fotaState = lineValue(section(raw, 'FOTA state'), '^FOTASTATE');
		var fotaProgress = lineValue(section(raw, 'FOTA progress'), '^FOTADLQ').replace(/"/g, '').split(',');
		var total = Number(fotaProgress[fotaProgress.length - 2]) || 0;
		var received = Number(fotaProgress[fotaProgress.length - 1]) || 0;
		var percent = total > 0 ? Math.max(0, Math.min(100, Math.floor(received / total * 100))) : 0;
		var model = lineValue(identity, 'Model') || 'MT5700M';
		var revision = lineValue(identity, 'Revision') || lineValue(section(raw, 'Revision'), '');
		var imei = lineValue(identity, 'IMEI') || section(raw, 'IMEI').split(/\n/)[0];
		var buildDate = lineValue(version, '^VERSION:BDT');
		var software = lineValue(version, '^VERSION:EXTS');
		var hardware = lineValue(version, '^VERSION:EXTH');
		var stateNames = { '10': _('Waiting to download'), '11': _('Checking for updates'), '12': _('Update available'), '13': _('Update check failed'), '14': _('No update available'), '20': _('Download failed'), '30': _('Downloading'), '31': _('Download paused'), '40': _('Download complete'), '50': _('Preparing installation') };
		var stateName = fotaState ? (stateNames[fotaState] || _('Unknown state')) : _('Status unavailable');
		var stateClass = fotaState === '30' || fotaState === '40' || fotaState === '50' ? ' active' : fotaState === '13' || fotaState === '20' ? ' error' : '';
		var fotaUrl = E('input', { 'class': 'cbi-input-text', 'placeholder': 'http://server/path/' });
		var self = this;

		return E('div', { 'class': 'mt-system' }, [
			this.styleNode(),
			res.stderr ? E('div', { 'class': 'alert-message warning' }, res.stderr) : null,
			E('section', { 'class': 'mt-system-hero' }, [
				E('div', {}, [ E('div', { 'class': 'mt-system-kicker' }, _('MODEM SYSTEM')), E('h2', { 'class': 'mt-system-title' }, model), E('div', { 'class': 'mt-system-sub' }, revision || _('Module information')) ]),
				E('div', { 'class': 'mt-system-temp' }, [ E('strong', {}, temperature ? temperature + '°' : '--'), E('span', {}, _('Module Temperature')) ])
			]),
			E('div', { 'class': 'mt-system-grid' }, [
				E('section', { 'class': 'mt-system-card' }, [ E('h3', {}, _('Device identity')), this.row(_('Model'), model), this.row(_('Firmware version'), software || revision), this.row(_('Hardware version'), hardware), this.row('IMEI', imei) ]),
				E('section', { 'class': 'mt-system-card' }, [ E('h3', {}, _('Runtime status')), this.row(_('SIM Status'), sim), this.row(_('Operator'), operatorValues[2] || '--'), this.row(_('Build date'), buildDate), this.row(_('FOTA mode'), fotaModeName) ])
			]),
			E('section', { 'class': 'mt-system-fota' }, [
				E('div', { 'class': 'mt-system-fota-head' }, [ E('div', {}, [ E('h3', {}, _('Firmware update')), E('p', {}, _('Use an MT5700M-compatible HTTP update server. Do not interrupt power during installation.')) ]), E('span', { 'class': 'mt-system-state' + stateClass }, stateName) ]),
				E('div', { 'class': 'mt-system-progress' }, E('span', { 'style': 'width:%d%%'.format(percent) })), E('div', { 'class': 'mt-system-progress-label' }, _('%d%% complete').format(percent)),
				E('div', { 'class': 'mt-system-url' }, [ fotaUrl, E('button', { 'class': 'btn cbi-button-action', 'click': function() {
					if (!/^http:\/\//.test(fotaUrl.value || ''))
						return ui.addNotification(null, E('p', {}, _('Enter a valid HTTP update-server URL.')), 'warning');
					self.runConfirmed(_('Start firmware download'), _('The modem will contact the specified server and may temporarily use mobile data.'), [ 'fota-start', fotaUrl.value ], false);
				} }, _('Check and download')) ]),
				E('div', { 'class': 'mt-system-actions' }, [
					E('button', { 'class': 'btn cbi-button', 'click': function() { window.location.reload(); } }, _('Refresh status')),
					E('button', { 'class': 'btn cbi-button', 'disabled': fotaState === '31' ? null : 'disabled', 'click': function() { self.runConfirmed(_('Resume download'), _('Resume the paused firmware download?'), [ 'fota-resume' ], false); } }, _('Resume Download')),
					E('button', { 'class': 'btn cbi-button-negative', 'disabled': fotaState === '40' ? null : 'disabled', 'click': function() { self.runConfirmed(_('Install firmware'), _('The modem will restart. Do not disconnect power until installation is complete.'), [ 'fota-upgrade' ], true); } }, _('Install update')),
					E('button', { 'class': 'btn cbi-button-negative', 'click': function() { self.runConfirmed(_('Restart Module'), _('This will restart the MT5700M module and temporarily interrupt 5G connectivity.'), [ 'restart' ], true); } }, _('Restart Module'))
				])
			]),
			E('details', { 'class': 'mt-system-details' }, [ E('summary', {}, _('Technical details')), E('pre', { 'class': 'mt-system-raw' }, raw || _('No response.')) ])
		]);
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null
});
