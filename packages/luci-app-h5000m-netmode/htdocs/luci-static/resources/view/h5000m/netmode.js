'use strict';
'require view';
'require form';
'require fs';
'require ui';

return view.extend({
	load: function() {
		return fs.exec('/usr/sbin/h5000m-netmode', [ 'status' ]).catch(function() {
			return { stdout: '' };
		});
	},

	parseStatus: function(res) {
		var data = {};

		(res.stdout || '').trim().split(/\n/).forEach(function(line) {
			var pos = line.indexOf('=');

			if (pos > -1)
				data[line.substring(0, pos)] = line.substring(pos + 1);
		});

		return data;
	},

	statusTable: function(data) {
		var labels = {
			wan_first: _('Wired WAN first, 5G fallback'),
			modem_first: _('5G modem first, wired WAN fallback'),
			wan_only: _('Wired WAN only'),
			modem_only: _('5G modem only')
		};
		var mode = labels[data.mode] || labels.wan_first;

		return E('div', { 'class': 'cbi-section' }, [
			E('h3', _('Current Status')),
			E('table', { 'class': 'table' }, [
				E('tr', [ E('td', _('Current Mode')), E('td', mode) ]),
				E('tr', [ E('td', _('IPv4 Default Route')), E('td', data.active4 || _('Unknown')) ]),
				E('tr', [ E('td', _('IPv6 Default Route')), E('td', data.active6 || _('None')) ]),
				E('tr', [ E('td', _('Wired WAN Metric')), E('td', '%s / %s'.format(data.wan_metric || '-', data.wan6_metric || '-')) ]),
				E('tr', [ E('td', _('5G Modem Metric')), E('td', '%s / %s'.format(data.usb_metric || '-', data.usbv6_metric || '-')) ]),
				E('tr', [
					E('td', _('Wired WAN Default Route')),
					E('td', '%s / %s'.format(
						data.wan_defaultroute == '0' ? _('Disabled') : _('Enabled'),
						data.wan6_defaultroute == '0' ? _('Disabled') : _('Enabled')))
				]),
				E('tr', [
					E('td', _('5G Modem Default Route')),
					E('td', '%s / %s'.format(
						data.usb_defaultroute == '0' ? _('Disabled') : _('Enabled'),
						data.usbv6_defaultroute == '0' ? _('Disabled') : _('Enabled')))
				])
			])
		]);
	},

	render: function(res) {
		var m, s, o;
		var status = this.parseStatus(res);

		m = new form.Map('h5000m_netmode', _('Exit Priority'));
		m.description = _('Switch the default route priority between wired WAN and the 5G modem.');

		s = m.section(form.NamedSection, 'settings', 'settings');
		s.anonymous = true;

		o = s.option(form.ListValue, 'mode', _('Exit Mode'));
		o.value('wan_first', _('Wired WAN first, 5G fallback'));
		o.value('modem_first', _('5G modem first, wired WAN fallback'));
		o.value('wan_only', _('Wired WAN only'));
		o.value('modem_only', _('5G modem only'));
		o.default = 'wan_first';
		o.rmempty = false;

		m.handleSaveApply = function(ev, mode) {
			return form.Map.prototype.handleSaveApply.apply(this, [ ev, mode ]).then(function() {
				return fs.exec('/usr/sbin/h5000m-netmode', [ 'apply' ]).then(function() {
					ui.addNotification(null, E('p', _('Exit priority has been applied.')));
				}, function(err) {
					ui.addNotification(null, E('p', _('Failed to apply exit priority:') + ' ' + err.message), 'danger');
				});
			});
		};

		return m.render().then(L.bind(function(node) {
			return E('div', {}, [ this.statusTable(status), node ]);
		}, this));
	}
});
