'use strict';
'require view';
'require fs';
'require ui';

function parseValues(text) {
	var data = {};
	(text || '').split(/\r?\n/).forEach(function(line) {
		var p = line.indexOf('=');
		if (p > 0) data[line.substring(0, p)] = line.substring(p + 1);
	});
	return data;
}

function cleanCsv(value) {
	return (value || '').replace(/\s+/g, '').replace(/^,+|,+$/g, '').replace(/,+/g, ',');
}

function validCsv(value) {
	return /^[0-9]+(,[0-9]+)*$/.test(value);
}

return view.extend({
	load: function() {
		return fs.exec('/usr/sbin/mt5700m-at', [ 'lock-status' ]).then(function(res) {
			return parseValues(res.stdout);
		}, function() { return {}; });
	},

	styleNode: function() {
		return E('style', {}, [
			'.mt-lock-hero{padding:22px 24px;border-radius:14px;background:linear-gradient(135deg,#11263d,#173f5d);color:#fff;margin-bottom:16px}',
			'.mt-lock-hero h2{color:#fff;margin:0 0 7px;font-size:24px}.mt-lock-hero p{margin:0;color:#c7d7e6;max-width:720px}',
			'.mt-lock-current{display:flex;gap:10px;flex-wrap:wrap;margin-top:16px}.mt-lock-chip{padding:7px 11px;border-radius:999px;background:rgba(255,255,255,.12);font-size:12px}.mt-lock-chip b{margin-left:5px}',
			'.mt-lock-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}',
			'.mt-lock-card{border:1px solid var(--border-color-low,#e6e9ed);border-radius:12px;background:var(--background-color-high,#fff);overflow:hidden}',
			'.mt-lock-head{padding:17px 18px;border-bottom:1px solid var(--border-color-low,#edf0f3)}.mt-lock-head h3{margin:0 0 4px}.mt-lock-head p{margin:0;color:var(--text-color-secondary,#68727d);font-size:12px}',
			'.mt-lock-body{padding:16px 18px}.mt-lock-field{margin-bottom:14px}.mt-lock-field label{display:block;font-size:12px;font-weight:600;margin-bottom:6px}.mt-lock-field input,.mt-lock-field select{width:100%}',
			'.mt-lock-help{font-size:11px;color:var(--text-color-secondary,#7a838c);margin-top:5px}.mt-lock-actions{display:flex;justify-content:flex-end;margin-top:18px}',
			'@media(max-width:800px){.mt-lock-grid{grid-template-columns:1fr}.mt-lock-hero{padding:20px}}'
		].join(''));
	},

	stateLabel: function(value) {
		return !value || value === '0' ? _('Not locked') : _('Locked');
	},

	lockPanel: function(title, rat) {
		var type = E('select', { 'class': 'cbi-input-select' }, [
			E('option', { 'value': '3' }, _('Band Lock')),
			E('option', { 'value': '1' }, _('ARFCN Lock')),
			E('option', { 'value': '2' }, _('Cell Lock')),
			E('option', { 'value': '0' }, _('Remove Lock'))
		]);
		var bands = E('input', { 'class': 'cbi-input-text', 'placeholder': rat === 'nr' ? '78,41' : '3,8', 'inputmode': 'numeric' });
		var arfcns = E('input', { 'class': 'cbi-input-text', 'placeholder': rat === 'nr' ? '630000,520000' : '1850,3450', 'inputmode': 'numeric' });
		var scs = E('input', { 'class': 'cbi-input-text', 'placeholder': '1,1', 'inputmode': 'numeric' });
		var pcis = E('input', { 'class': 'cbi-input-text', 'placeholder': '100,200', 'inputmode': 'numeric' });
		var fields = { bands: bands, arfcns: arfcns, scs: scs, pcis: pcis };
		var self = this;

		function field(label, node, help, key) {
			var wrap = E('div', { 'class': 'mt-lock-field', 'data-field': key }, [ E('label', {}, label), node, E('div', { 'class': 'mt-lock-help' }, help) ]);
			fields[key + 'Wrap'] = wrap;
			return wrap;
		}

		function updateFields() {
			var t = type.value;
			fields.bandsWrap.style.display = t === '0' ? 'none' : '';
			fields.arfcnsWrap.style.display = t === '1' || t === '2' ? '' : 'none';
			if (rat === 'nr') fields.scsWrap.style.display = t === '1' || t === '2' ? '' : 'none';
			fields.pcisWrap.style.display = t === '2' ? '' : 'none';
		}

		function apply() {
			var t = type.value, values = [ cleanCsv(bands.value), cleanCsv(arfcns.value), cleanCsv(scs.value), cleanCsv(pcis.value) ];
			var required = t === '0' ? [] : t === '3' ? [ 0 ] : t === '1' ? (rat === 'nr' ? [ 0, 1, 2 ] : [ 0, 1 ]) : (rat === 'nr' ? [ 0, 1, 2, 3 ] : [ 0, 1, 3 ]);
			if (required.some(function(i) { return !validCsv(values[i]); })) {
				ui.addNotification(null, E('p', {}, _('Complete all required fields using comma-separated numbers.')), 'warning');
				return;
			}
			var lengths = required.map(function(i) { return values[i].split(',').length; });
			if (lengths.some(function(n) { return n !== lengths[0]; })) {
				ui.addNotification(null, E('p', {}, _('Each field must contain the same number of values.')), 'warning');
				return;
			}
			var args = rat === 'nr' ? [ 'lock', rat, t, values[0], values[1], values[2], values[3] ] : [ 'lock', rat, t, values[0], values[1], values[3] ];
			var summary = t === '0' ? _('Remove the current %s frequency lock?').format(rat.toUpperCase()) : _('Apply this %s frequency lock? Mobile connectivity may reconnect.').format(rat.toUpperCase());
			return ui.showModal(_('Confirm frequency change'), [ E('p', {}, summary), E('div', { 'class': 'right' }, [
				E('button', { 'class': 'btn', 'click': ui.hideModal }, _('Cancel')), ' ',
				E('button', { 'class': 'btn cbi-button-negative', 'click': function() {
					ui.hideModal();
					fs.exec('/usr/sbin/mt5700m-at', args).then(function() { ui.addNotification(null, E('p', {}, _('Frequency lock updated.'))); }, function(err) { ui.addNotification(null, E('p', {}, err.message || _('The modem rejected this setting.')), 'danger'); });
				} }, t === '0' ? _('Remove Lock') : _('Apply Lock'))
			]) ]);
		}

		type.addEventListener('change', updateFields);
		var children = [
			E('div', { 'class': 'mt-lock-head' }, [ E('h3', {}, title), E('p', {}, rat === 'nr' ? _('Configure 5G NR frequency selection.') : _('Configure LTE frequency selection.')) ]),
			E('div', { 'class': 'mt-lock-body' }, [
				field(_('Lock Type'), type, _('Choose the least restrictive mode that meets your need.'), 'type'),
				field(_('Bands'), bands, _('Use numbers separated by commas.'), 'bands'),
				field(_('ARFCNs'), arfcns, _('One ARFCN for each band.'), 'arfcns'),
				rat === 'nr' ? field(_('SCS Types'), scs, _('One SCS type for each NR band.'), 'scs') : null,
				field(_('PCI'), pcis, _('One PCI for each band and ARFCN.'), 'pcis'),
				E('div', { 'class': 'mt-lock-actions' }, E('button', { 'class': 'btn cbi-button-apply', 'click': apply }, _('Review and apply')))
			])
		];
		var panel = E('section', { 'class': 'mt-lock-card' }, children);
		window.setTimeout(updateFields, 0);
		return panel;
	},

	render: function(data) {
		return E('div', {}, [ this.styleNode(),
			E('section', { 'class': 'mt-lock-hero' }, [ E('h2', {}, _('Frequency selection')), E('p', {}, _('Limit the modem to specific bands or cells only when network troubleshooting requires it. Incorrect values can interrupt mobile connectivity.')),
				E('div', { 'class': 'mt-lock-current' }, [ E('span', { 'class': 'mt-lock-chip' }, [ 'LTE', E('b', {}, this.stateLabel(data.lte_lock)) ]), E('span', { 'class': 'mt-lock-chip' }, [ '5G NR', E('b', {}, this.stateLabel(data.nr_lock)) ]) ])
			]),
			E('div', { 'class': 'mt-lock-grid' }, [ this.lockPanel(_('LTE network'), 'lte'), this.lockPanel(_('5G NR network'), 'nr') ])
		]);
	}
});
