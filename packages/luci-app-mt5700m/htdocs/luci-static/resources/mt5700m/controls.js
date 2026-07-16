'use strict';
'require baseclass';
'require ui';
'require fs';

function section(raw, label) {
	var marker = '===== ' + label + ':', active = false, output = [];
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

function pick(text, expression, fallback) {
	var match = (text || '').match(expression);
	return match ? match[1] : fallback;
}

function select(options, value) {
	var node = E('select', { 'class': 'cbi-input-select' }, options.map(function(item) {
		return E('option', { 'value': item[0] }, item[1]);
	}));
	if (value != null)
		node.value = String(value);
	return node;
}

function confirmRun(title, message, args, restartRequired) {
	return ui.showModal(title, [
		E('p', {}, message),
		restartRequired ? E('div', { 'class': 'alert-message warning' }, _('A module restart or airplane-mode cycle is required before this change takes effect.')) : null,
		E('div', { 'class': 'right' }, [
			E('button', { 'type': 'button', 'class': 'btn', 'click': ui.hideModal }, _('Cancel')), ' ',
			E('button', {
				'type': 'button',
				'class': 'btn cbi-button-negative',
				'click': function() {
					ui.hideModal();
					fs.exec('/usr/sbin/mt5700m-at', args).then(function() {
						ui.addNotification(null, E('p', {}, _('Settings applied.')));
						window.setTimeout(function() { window.location.reload(); }, 900);
					}, function(err) {
						ui.addNotification(null, E('p', {}, err.message || String(err)), 'danger');
					});
				}
			}, _('Apply'))
		])
	]);
}

function row(label, input) {
	return E('div', { 'class': 'mt-control-row' }, [ E('label', {}, label), input ]);
}

function action(label, handler) {
	return E('div', { 'class': 'mt-control-actions' }, E('button', {
		'type': 'button',
		'class': 'btn cbi-button-apply',
		'click': handler
	}, label));
}

function card(title, desc, body, wide) {
	return E('section', { 'class': 'mt-control-card mt-ui-card' + (wide ? ' wide' : '') }, [
		E('h3', {}, title),
		E('div', { 'class': 'mt-control-desc' }, desc)
	].concat(body));
}

function state(label, value) {
	return E('div', { 'class': 'mt-control-state' }, [ E('span', {}, label), E('strong', {}, value || '--') ]);
}

function styleNode() {
	return E('style', {}, [
		'.mt-ui-page{--mt-ui-accent:#1264d8;--mt-ui-teal:#07988e;--mt-ui-border:var(--border-color-medium,#d9dde4);--mt-ui-border-soft:var(--border-color-low,#edf0f4);--mt-ui-surface:var(--background-color-high,#fff);--mt-ui-muted:var(--text-color-medium,#69717d);max-width:1120px;margin:0 auto;color:var(--text-color-high,#20242a)}',
		'.mt-ui-hero{display:flex;justify-content:space-between;align-items:center;gap:20px;padding:22px 24px;margin:0 0 16px;border:0;border-radius:16px;background:linear-gradient(135deg,#1264d8 0%,#087eae 58%,#07988e 100%);color:#fff;box-shadow:0 10px 28px rgba(14,92,155,.16)}.mt-ui-hero h2{margin:0 0 6px;color:#fff;font-size:24px;line-height:1.2}.mt-ui-hero p,.mt-ui-hero [class*="-sub"]{margin:0;color:rgba(255,255,255,.78);font-size:12px;line-height:1.5}.mt-ui-hero [class*="kicker"],.mt-ui-hero [class*="eyebrow"]{color:rgba(255,255,255,.68);font-size:11px;font-weight:750;letter-spacing:.08em;text-transform:uppercase}',
		'.mt-ui-card{border:1px solid var(--mt-ui-border);border-radius:14px;background:var(--mt-ui-surface);box-shadow:0 3px 12px rgba(20,32,50,.04)}',
		'.mt-ui-page .btn{border-radius:9px}.mt-ui-page input,.mt-ui-page select,.mt-ui-page textarea{border-radius:8px}',
		'.mt-ui-details{margin-top:14px;border:1px solid var(--mt-ui-border);border-radius:14px;background:var(--mt-ui-surface);overflow:hidden}.mt-ui-details>summary{display:grid;grid-template-columns:minmax(0,1fr) 34px;align-items:center;gap:14px;min-height:54px;padding:10px 12px 10px 18px;cursor:pointer;list-style:none;transition:background-color .16s ease}.mt-ui-details>summary::-webkit-details-marker{display:none}.mt-ui-details>summary:hover{background:var(--background-color-low,#f6f8fa)}.mt-ui-summary-copy{min-width:0}.mt-ui-summary-title{display:block;font-size:14px;font-weight:700;line-height:1.35}.mt-ui-summary-desc{display:block;margin-top:3px;color:var(--mt-ui-muted);font-size:11px;font-weight:400;line-height:1.45}.mt-ui-chevron{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border:1px solid var(--mt-ui-border-soft);border-radius:9px;background:var(--background-color-low,#f5f7f9);color:var(--mt-ui-muted);font-size:22px;line-height:1;transform:rotate(0deg);transition:transform .18s ease,background-color .18s ease,color .18s ease}.mt-ui-details[open]>summary .mt-ui-chevron{transform:rotate(90deg);background:#eaf4ff;color:#176bc1}.mt-ui-details[open]>summary{border-bottom:1px solid var(--mt-ui-border-soft)}.mt-ui-details:not([open])>.mt-ui-details-body{display:none}',
		'.mt-control-section{margin-top:20px}.mt-control-section-head{margin:0 0 11px}.mt-control-section-head h3{margin:0 0 4px;font-size:17px}.mt-control-section-head p{margin:0;color:var(--text-color-medium,#6e7783);font-size:12px;line-height:1.5}',
		'.mt-control-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px}.mt-control-card{padding:18px;border:1px solid var(--border-color-medium,#d9dde4);border-radius:13px;background:var(--background-color-high,#fff)}.mt-control-card.wide{grid-column:1/-1}',
		'.mt-control-card h3{margin:0 0 5px;font-size:15px}.mt-control-desc{font-size:12px;color:var(--text-color-medium,#6e7783);margin-bottom:14px;line-height:1.5}.mt-control-row{display:grid;grid-template-columns:145px 1fr;gap:10px;align-items:center;margin:11px 0}.mt-control-row label{font-size:12px;color:var(--text-color-medium,#6e7783)}.mt-control-row input,.mt-control-row select{width:100%;box-sizing:border-box}',
		'.mt-control-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:15px}.mt-control-note{padding:10px 12px;border-radius:8px;background:#fff7e5;color:#795300;font-size:11px;line-height:1.5;margin-top:12px}.mt-control-state{display:flex;justify-content:space-between;gap:14px;padding:9px 0;border-bottom:1px solid var(--border-color-low,#edf0f4);font-size:12px}.mt-control-state:last-child{border-bottom:0}.mt-control-state span{color:var(--text-color-medium,#6e7783)}.mt-control-state strong{text-align:right}',
		'.mt-control-card.mt-ui-card{border-radius:14px}',
		'@media(max-width:760px){.mt-ui-hero{display:block;padding:20px}.mt-ui-card{border-radius:13px}.mt-ui-details>summary{grid-template-columns:minmax(0,1fr) 32px;padding-left:15px}.mt-control-grid{grid-template-columns:1fr}.mt-control-row{grid-template-columns:1fr;gap:5px}}'
	].join(''));
}

return baseclass.extend({
	section: section,
	pick: pick,
	select: select,
	confirmRun: confirmRun,
	row: row,
	action: action,
	card: card,
	state: state,
	styleNode: styleNode
});
