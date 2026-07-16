'use strict';
'require view';
'require fs';
'require rpc';
'require uci';
'require ui';

var callBaseInfo = rpc.declare({ object: 'qmodem', method: 'base_info', params: [ 'config_section' ], expect: { } });
var callCellInfo = rpc.declare({ object: 'qmodem', method: 'cell_info', params: [ 'config_section' ], expect: { } });
var callDialStatus = rpc.declare({ object: 'qmodem', method: 'dial_status', params: [ 'config_section' ], expect: { } });

return view.extend({
	load: function() {
		return uci.load('qmodem').then(function() {
			var sections = uci.sections('qmodem', 'modem-device');
			var matches = sections.filter(function(section) {
				var identity = [ section.name, section.alias, section.manufacturer, section.platform ].join(' ').toLowerCase();
				return /mt5700|huawei|hisilicon/.test(identity) || section.at_port === '/dev/ttyUSB1';
			});
			var modem = matches.find(function(section) { return section.state !== 'disabled'; }) || matches[0] || sections.find(function(section) { return section.state !== 'disabled'; }) || sections[0];

			if (!modem)
				throw new Error(_('No QModem modem was found.'));

			/* The native helper obtains one coherent snapshot through at-daemon.
			 * Running QModem base_info and cell_info in parallel makes both paths
			 * compete for the same serial channel and occasionally returns a
			 * partial page. Read the snapshot first, then add the lightweight
			 * QModem connection state. */
			return fs.exec('/usr/sbin/mt5700m-at', [ 'status' ]).then(function(nativeStatus) {
				return Promise.all([
					callBaseInfo(modem['.name']).catch(function() { return {}; }),
					callDialStatus(modem['.name']).catch(function() { return {}; })
				]).then(function(results) {
					return { qmodem: true, modem: modem, native: nativeStatus, base: results[0], dial: results[1] };
				});
			}, function(nativeError) {
				return Promise.all([
					callBaseInfo(modem['.name']),
					callCellInfo(modem['.name']),
					callDialStatus(modem['.name'])
				]).then(function(results) {
					return { qmodem: true, modem: modem, base: results[0], cell: results[1], dial: results[2] };
				}, function() {
					return { stdout: '', stderr: nativeError.message || String(nativeError) };
				});
			});
		}).catch(function(err) {
			return fs.exec('/usr/sbin/mt5700m-at', [ 'status' ]).catch(function(fallbackErr) {
				return { stdout: '', stderr: fallbackErr.message || err.message || String(fallbackErr) };
			});
		});
	},

	parseStatus: function(res) {
		var data = {};
		var parseOutput = function(output) {
			(output || '').trim().split(/\n/).forEach(function(line) {
				var pos = line.indexOf('=');

				if (pos > -1)
					data[line.substring(0, pos)] = line.substring(pos + 1);
			});
		};
		var collect = function(entries) {
			(entries || []).forEach(function(entry) {
				if (entry && entry.key != null)
					data[entry.key] = entry.value;
			});
		};

		if (res.qmodem) {
			if (res.native)
				parseOutput(res.native.stdout);

			data.reachable = data.connected === '1' ? '1' : '0';
			collect(res.base && res.base.modem_info);
			collect(res.cell && res.cell.modem_info);
			data.model = data.name || res.modem.name || 'MT5700M';
			data.revision = data.revision || '';
			data.at_port = data.at_port || res.modem.at_port || '';
			data.temperature = String(data.temperature || '').replace(/[^0-9.-]/g, '');
			/* QModem reports these fields with upper-case keys, while the native
			 * MT5700M snapshot uses lower-case keys. Keep the native values when
			 * QModem omits a field instead of replacing them with an empty string. */
			data.sysmode_detail = data.network_mode || data.sysmode_detail || data.sysmode || '';
			data.rsrp = data.RSRP || data.rsrp || '';
			data.rsrq = data.RSRQ || data.rsrq || '';
			data.sinr = data.SINR || data.sinr || '';
			if (data.reachable !== '1' && (data.name || data.revision || data.at_port))
				data.reachable = '1';
			data.connected = /^(yes|connected|1|true)$/i.test(String(data.connect_status || data.connected || '')) ? '1' : '0';
			data.dial_running = String((res.dial || {}).running || '') === 'true' ? '1' : '0';
			data.network_interface = res.modem.network || res.modem.data_interface || '';
			data.channel = 'serial';
			data.backend = 'QModem';
			return data;
		}

		parseOutput(res.stdout);

		data.reachable = data.connected === '1' ? '1' : '0';
		data.connected = data.reachable === '1' && !/^(|NOSERVICE|NO SERVICE|UNKNOWN)$/i.test(data.sysmode || data.sysmode_detail || '') ? '1' : '0';
		data.error = res.stderr || '';
		data.backend = _('Direct AT fallback');
		return data;
	},

	styleNode: function() {
		return E('style', {}, [
			'.mt5700m-page{max-width:1120px;margin:0 auto;color:var(--text-color-high,#20242a)}',
			'.mt5700m-hero{position:relative;overflow:hidden;padding:24px 26px;margin:0 0 18px;border-radius:16px;background:linear-gradient(135deg,#1264d8 0%,#087eae 58%,#07988e 100%);color:#fff;box-shadow:0 10px 30px rgba(14,92,155,.18)}',
			'.mt5700m-hero:after{content:"";position:absolute;width:220px;height:220px;right:-72px;top:-108px;border:44px solid rgba(255,255,255,.08);border-radius:50%}',
			'.mt5700m-hero-top{position:relative;z-index:1;display:flex;justify-content:space-between;align-items:flex-start;gap:18px}',
			'.mt5700m-eyebrow{font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;opacity:.78;margin-bottom:5px}',
			'.mt5700m-title{font-size:28px;line-height:1.18;font-weight:720;margin:0 0 7px;color:#fff}',
			'.mt5700m-summary{font-size:14px;line-height:1.5;opacity:.88}',
			'.mt5700m-status{display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border-radius:999px;background:rgba(255,255,255,.16);font-size:13px;font-weight:650;white-space:nowrap;backdrop-filter:blur(4px)}',
			'.mt5700m-dot{width:8px;height:8px;border-radius:50%;background:#ffcd57;box-shadow:0 0 0 4px rgba(255,205,87,.18)}',
			'.mt5700m-status.is-reachable .mt5700m-dot{background:#ffcd57;box-shadow:0 0 0 4px rgba(255,205,87,.18)}',
			'.mt5700m-status.is-online .mt5700m-dot{background:#78f2b0;box-shadow:0 0 0 4px rgba(120,242,176,.18)}',
			'.mt5700m-hero-meta{position:relative;z-index:1;display:flex;flex-wrap:wrap;gap:8px 22px;margin-top:22px;font-size:13px}',
			'.mt5700m-meta{display:flex;gap:7px;align-items:center}',
			'.mt5700m-meta-label{opacity:.7}',
			'.mt5700m-meta-value{font-weight:650}',
			'.mt5700m-section-title{font-size:16px;font-weight:700;margin:22px 0 11px}',
			'.mt5700m-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}',
			'.mt5700m-metric{padding:16px;border:1px solid var(--border-color-medium,#d9dde4);border-radius:13px;background:var(--background-color-high,#fff);box-shadow:0 3px 12px rgba(20,32,50,.04)}',
			'.mt5700m-metric-label{font-size:12px;color:var(--text-color-medium,#69717d);margin-bottom:8px}',
			'.mt5700m-metric-line{display:flex;align-items:baseline;gap:5px}',
			'.mt5700m-metric-value{font-size:23px;line-height:1.15;font-weight:720;letter-spacing:-.02em}',
			'.mt5700m-metric-unit{font-size:12px;color:var(--text-color-medium,#69717d)}',
			'.mt5700m-meter{height:4px;margin-top:13px;border-radius:999px;background:var(--border-color-low,#edf0f4);overflow:hidden}',
			'.mt5700m-meter span{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#1e88ff,#05aa91)}',
			'.mt5700m-content-grid{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(260px,.75fr);gap:14px}',
			'.mt5700m-panel{border:1px solid var(--border-color-medium,#d9dde4);border-radius:13px;background:var(--background-color-high,#fff);overflow:hidden}',
			'.mt5700m-panel-head{padding:14px 16px;border-bottom:1px solid var(--border-color-low,#edf0f4);font-size:14px;font-weight:700}',
			'.mt5700m-detail-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));padding:4px 16px 12px}',
			'.mt5700m-detail{padding:12px 0;border-bottom:1px solid var(--border-color-low,#edf0f4)}',
			'.mt5700m-detail:nth-last-child(-n+2){border-bottom:0}',
			'.mt5700m-detail:nth-child(odd){padding-right:18px}',
			'.mt5700m-detail-label{font-size:11px;color:var(--text-color-medium,#727a86);margin-bottom:4px}',
			'.mt5700m-detail-value{font-size:14px;font-weight:600;word-break:break-word}',
			'.mt5700m-locks{padding:5px 16px 12px}',
			'.mt5700m-lock{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 0;border-bottom:1px solid var(--border-color-low,#edf0f4)}',
			'.mt5700m-lock:last-child{border-bottom:0}',
			'.mt5700m-lock-name{font-size:13px;font-weight:600}',
			'.mt5700m-lock-state{padding:4px 9px;border-radius:999px;background:#eaf8f3;color:#087b62;font-size:11px;font-weight:700}',
			'.mt5700m-lock-state.is-locked{background:#fff1df;color:#a45d00}',
			'.mt5700m-actions{display:flex;flex-wrap:wrap;align-items:center;gap:9px;margin-top:16px}',
			'.mt5700m-actions .btn{border-radius:9px;padding:7px 14px}',
			'.mt5700m-alert{margin:0 0 14px}',
			'@media(max-width:760px){.mt5700m-hero{padding:20px}.mt5700m-title{font-size:23px}.mt5700m-hero-top{display:block}.mt5700m-status{margin-top:14px}.mt5700m-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.mt5700m-content-grid{grid-template-columns:1fr}}',
			'@media(max-width:430px){.mt5700m-metrics{grid-template-columns:1fr}.mt5700m-detail-grid{grid-template-columns:1fr}.mt5700m-detail:nth-child(odd){padding-right:0}.mt5700m-detail:nth-last-child(2){border-bottom:1px solid var(--border-color-low,#edf0f4)}}'
		].join(''));
	},

	metric: function(label, value, unit, percentage) {
		var missing = value == null || value === '' || value === 'null';
		var width = Math.max(0, Math.min(100, Number(percentage) || 0));

		return E('div', { 'class': 'mt5700m-metric' }, [
			E('div', { 'class': 'mt5700m-metric-label' }, label),
			E('div', { 'class': 'mt5700m-metric-line' }, [
				E('span', { 'class': 'mt5700m-metric-value' }, missing ? '--' : String(value)),
				!missing && unit ? E('span', { 'class': 'mt5700m-metric-unit' }, unit) : null
			]),
			E('div', { 'class': 'mt5700m-meter' }, E('span', { 'style': 'width:%d%%'.format(width) }))
		]);
	},

	detail: function(label, value) {
		return E('div', { 'class': 'mt5700m-detail' }, [
			E('div', { 'class': 'mt5700m-detail-label' }, label),
			E('div', { 'class': 'mt5700m-detail-value' }, value || _('Unknown'))
		]);
	},

	lockRow: function(label, value) {
		var unlocked = value === '0' || value === '' || value == null;

		return E('div', { 'class': 'mt5700m-lock' }, [
			E('span', { 'class': 'mt5700m-lock-name' }, label),
			E('span', { 'class': 'mt5700m-lock-state' + (unlocked ? '' : ' is-locked') }, unlocked ? _('Not locked') : _('Locked'))
		]);
	},

	actionButton: function(label, command, cssClass, confirmText) {
		return E('button', {
			'class': 'btn ' + (cssClass || 'cbi-button'),
			'click': function(ev) {
				var button = ev.currentTarget;
				var run = function() {
					button.disabled = true;
					return fs.exec('/usr/sbin/mt5700m-at', command).then(function(res) {
						ui.addNotification(null, E('p', {}, res.stdout ? _('Command completed.') : _('Command completed.')));
					}, function(err) {
						ui.addNotification(null, E('p', {}, err.message || String(err)), 'danger');
					}).finally(function() {
						button.disabled = false;
					});
				};

				if (!confirmText)
					return run();

				return ui.showModal(_('Confirm Action'), [
					E('p', {}, confirmText),
					E('div', { 'class': 'right' }, [
						E('button', { 'class': 'btn', 'click': ui.hideModal }, _('Cancel')),
						' ',
						E('button', { 'class': 'btn cbi-button-negative', 'click': function() { ui.hideModal(); run(); } }, _('Continue'))
					])
				]);
			}
		}, label);
	},

	render: function(res) {
		var data = this.parseStatus(res);
		var reachable = data.reachable === '1';
		var connected = data.connected === '1';
		var rsrp = parseFloat(data.rsrp);
		var rsrq = parseFloat(data.rsrq);
		var sinr = parseFloat(data.sinr);
		var temp = parseFloat(data.temperature);
		var operator = data.operator || '';
		if (!/[A-Za-z0-9\u4e00-\u9fff]/.test(operator))
			operator = '';
		var channel = data.channel === 'serial'
			? '%s · %s'.format(_('Serial Port'), data.at_port || _('Auto'))
			: '%s · %s:%s'.format(_('Network TCP'), data.host || '192.168.8.1', data.port || '20249');

		return E('div', { 'class': 'mt5700m-page' }, [
			this.styleNode(),
			data.error ? E('div', { 'class': 'alert-message warning mt5700m-alert' }, data.error) : null,
			E('section', { 'class': 'mt5700m-hero' }, [
				E('div', { 'class': 'mt5700m-hero-top' }, [
					E('div', {}, [
						E('div', { 'class': 'mt5700m-eyebrow' }, _('Mobile Network')),
						E('h2', { 'class': 'mt5700m-title' }, operator || data.model || 'MT5700M'),
						E('div', { 'class': 'mt5700m-summary' }, !reachable
							? _('The modem did not respond. Check the AT channel and module connection.')
							: connected
								? _('%s network is available and the modem is operating normally.').format(data.sysmode_detail || data.sysmode || '5G')
								: _('The modem is online, but mobile data is not connected.'))
					]),
					E('div', { 'class': 'mt5700m-status' + (connected ? ' is-online' : reachable ? ' is-reachable' : '') }, [
						E('span', { 'class': 'mt5700m-dot' }),
						connected ? _('Connected') : reachable ? _('Module online') : _('Unavailable')
					])
				]),
				E('div', { 'class': 'mt5700m-hero-meta' }, [
					E('div', { 'class': 'mt5700m-meta' }, [ E('span', { 'class': 'mt5700m-meta-label' }, _('Network Mode')), E('span', { 'class': 'mt5700m-meta-value' }, data.sysmode_detail || data.sysmode || '--') ]),
					E('div', { 'class': 'mt5700m-meta' }, [ E('span', { 'class': 'mt5700m-meta-label' }, _('Dialing process')), E('span', { 'class': 'mt5700m-meta-value' }, data.dial_running === '1' ? _('Running') : _('Stopped')) ]),
					E('div', { 'class': 'mt5700m-meta' }, [ E('span', { 'class': 'mt5700m-meta-label' }, _('Network interface')), E('span', { 'class': 'mt5700m-meta-value' }, data.network_interface || '--') ])
				])
			]),
			E('div', { 'class': 'mt5700m-section-title' }, _('Signal and temperature')),
			E('div', { 'class': 'mt5700m-metrics' }, [
				this.metric('RSRP', data.rsrp, 'dBm', isNaN(rsrp) ? 0 : (rsrp + 120) * 2.5),
				this.metric('RSRQ', data.rsrq, 'dB', isNaN(rsrq) ? 0 : (rsrq + 20) * 5),
				this.metric('SINR', data.sinr, 'dB', isNaN(sinr) ? 0 : (sinr + 10) * 2.5),
				this.metric(_('Temperature'), data.temperature, '°C', isNaN(temp) ? 0 : 100 - Math.max(0, temp - 35) * 2)
			]),
			E('div', { 'class': 'mt5700m-section-title' }, _('Device details')),
			E('div', { 'class': 'mt5700m-content-grid' }, [
				E('section', { 'class': 'mt5700m-panel' }, [
					E('div', { 'class': 'mt5700m-panel-head' }, _('Module information')),
					E('div', { 'class': 'mt5700m-detail-grid' }, [
						this.detail(_('Model'), data.model || data.manufacturer),
						this.detail(_('Firmware version'), data.revision),
						this.detail(_('Network interface'), data.network_interface),
						this.detail(_('Management backend'), data.backend)
					])
				]),
				E('section', { 'class': 'mt5700m-panel' }, [
					E('div', { 'class': 'mt5700m-panel-head' }, _('Connection')),
					E('div', { 'class': 'mt5700m-detail-grid' }, [
						this.detail(_('Mobile data'), connected ? _('Connected') : _('Disconnected')),
						this.detail(_('Dialing service'), data.dial_running === '1' ? _('Running') : _('Stopped')),
						this.detail(_('AT Channel'), channel),
						this.detail(_('Configuration'), _('QModem unified'))
					])
				])
			]),
			E('div', { 'class': 'mt5700m-actions' }, [
				E('button', { 'class': 'btn cbi-button-action', 'click': function() { window.location.reload(); } }, _('Refresh status')),
				this.actionButton(_('Restart Module'), [ 'restart' ], 'cbi-button-negative', _('This will restart the MT5700M module and temporarily interrupt 5G connectivity.'))
			])
		]);
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null
});
