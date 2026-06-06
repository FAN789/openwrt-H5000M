'use strict';
'require view';
'require form';
'require fs';
'require ui';

return view.extend({
	render: function() {
		var m, s, o;

		m = new form.Map('h5000m_netmode', _('H5000M 出口优先级'));
		m.description = _('切换有线 WAN 与 5G 模块的默认出口优先级。');

		s = m.section(form.NamedSection, 'settings', 'settings');
		s.anonymous = true;

		o = s.option(form.ListValue, 'mode', _('出口模式'));
		o.value('wan_first', _('有线 WAN 优先'));
		o.value('modem_first', _('5G 模块优先'));
		o.default = 'wan_first';
		o.rmempty = false;

		m.handleSaveApply = function(ev, mode) {
			return form.Map.prototype.handleSaveApply.apply(this, [ ev, mode ]).then(function() {
				return fs.exec('/usr/sbin/h5000m-netmode', [ 'apply' ]).then(function() {
					ui.addNotification(null, E('p', _('出口优先级已应用。')));
				}, function(err) {
					ui.addNotification(null, E('p', _('出口优先级应用失败：') + err.message), 'danger');
				});
			});
		};

		return m.render();
	}
});
