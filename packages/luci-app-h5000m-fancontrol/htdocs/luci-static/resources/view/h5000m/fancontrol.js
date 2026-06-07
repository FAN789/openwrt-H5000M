'use strict';
'require view';
'require form';
'require fs';
'require ui';

return view.extend({
	load: function() {
		return fs.exec('/usr/sbin/h5000m-fancontrol', [ 'status' ]).catch(function() {
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

	toNum: function(value, fallback) {
		var n = parseInt(value, 10);

		return isNaN(n) ? fallback : n;
	},

	normalizeTemp: function(value, fallback) {
		var n = this.toNum(value, fallback);

		if (isNaN(n))
			return fallback;

		return Math.abs(n) > 1000 ? Math.round(n / 1000) : n;
	},

	clamp: function(value, min, max) {
		return Math.max(min, Math.min(max, value));
	},

	formatTemp: function(value) {
		return value ? _('%s °C').format(value) : _('未知');
	},

	formatRpm: function(data) {
		if (data.fan_rpm)
			return _('%s RPM').format(data.fan_rpm);

		if (data.fan_feedback === '0')
			return _('无转速反馈');

		return _('未知');
	},

	statusCard: function(title, value, hint) {
		return E('div', { 'class': 'h5000m-fan-card' }, [
			E('div', { 'class': 'h5000m-fan-card-title' }, title),
			E('div', { 'class': 'h5000m-fan-card-value' }, value),
			hint ? E('div', { 'class': 'h5000m-fan-card-hint' }, hint) : null
		]);
	},

	styleNode: function() {
		return E('style', {}, [
			'.h5000m-fan-status,.h5000m-fan-curve{margin-bottom:16px}',
			'.h5000m-fan-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}',
			'.h5000m-fan-card{border:1px solid var(--border-color-medium,#d8d8d8);border-radius:8px;padding:12px;background:var(--background-color-high,#fff);min-height:76px}',
			'.h5000m-fan-card-title{font-size:12px;color:var(--text-color-medium,#666);margin-bottom:6px}',
			'.h5000m-fan-card-value{font-size:21px;line-height:1.25;font-weight:600;color:var(--text-color-high,#222);word-break:break-word}',
			'.h5000m-fan-card-hint{font-size:11px;color:var(--text-color-low,#888);margin-top:6px;word-break:break-word}',
			'.h5000m-fan-note{margin-top:10px;color:var(--text-color-medium,#666)}',
			'.h5000m-fan-curve-box{border:1px solid var(--border-color-medium,#d8d8d8);border-radius:8px;background:var(--background-color-high,#fff);padding:12px;overflow:hidden}',
			'.h5000m-fan-curve-canvas{width:100%;max-width:720px;height:240px;display:block}',
			'.h5000m-fan-legend{display:flex;flex-wrap:wrap;gap:12px;margin-top:8px;color:var(--text-color-medium,#666);font-size:12px}',
			'.h5000m-fan-swatch{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:5px;vertical-align:-1px}',
			'.h5000m-fan-slider{display:flex;align-items:center;gap:10px;max-width:460px}',
			'.h5000m-fan-slider input[type="range"]{flex:1;min-width:180px}',
			'.h5000m-fan-slider input[type="number"]{width:82px}'
		].join(''));
	},

	statusPanel: function(data) {
		var pwmHint = data.pwm ? data.pwm.replace('/sys/class/hwmon/', '') : _('未找到 PWM 节点');
		var fanHint = data.fan_feedback === '0' ? _('当前驱动未暴露 fan_input') : (data.fan || '');

		return E('div', { 'class': 'h5000m-fan-status' }, [
			E('h3', _('当前状态')),
			E('div', { 'class': 'h5000m-fan-grid' }, [
				this.statusCard(_('风扇转速'), this.formatRpm(data), fanHint),
				this.statusCard(_('当前 PWM'), data.pwm_value || _('未知'), pwmHint),
				this.statusCard(_('模块温度'), this.formatTemp(data.module_temp), _('来自 QModem 缓存')),
				this.statusCard(_('CPU 温度'), this.formatTemp(data.cpu_temp), data.temp1_label || ''),
				this.statusCard(_('WiFi 温度 1'), this.formatTemp(data.wifi1_temp), data.temp2_label || ''),
				this.statusCard(_('WiFi 温度 2'), this.formatTemp(data.wifi2_temp), data.temp3_label || '')
			]),
			data.fan_feedback === '0'
				? E('div', { 'class': 'h5000m-fan-note' }, _('当前系统只提供 PWM 控制，没有提供风扇转速反馈节点。'))
				: null
		]);
	},

	curveY: function(pwm, top, height) {
		return top + (255 - this.clamp(pwm, 0, 255)) * height / 255;
	},

	curveX: function(temp, minTemp, maxTemp, left, width) {
		return left + (this.clamp(temp, minTemp, maxTemp) - minTemp) * width / (maxTemp - minTemp);
	},

	pwmAtTemp: function(temp, low, high, minPwm, maxPwm) {
		if (temp <= low)
			return minPwm;
		if (temp >= high)
			return maxPwm;

		return Math.round(minPwm + (temp - low) * (maxPwm - minPwm) / (high - low));
	},

	drawCurveCanvas: function(canvasId, config) {
		var canvas = document.getElementById(canvasId);
		var ratio, width, height, ctx, left, top, right, bottom, plotW, plotH;
		var tempMin, tempMax, lowX, highX, minY, maxY, manualY, currentX, currentY;
		var xForTemp, yForPwm;

		if (!canvas)
			return;

		width = canvas.clientWidth || 640;
		height = canvas.clientHeight || 240;
		ratio = window.devicePixelRatio || 1;

		canvas.width = Math.round(width * ratio);
		canvas.height = Math.round(height * ratio);

		ctx = canvas.getContext('2d');
		ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
		ctx.clearRect(0, 0, width, height);

		left = 52;
		top = 20;
		right = 22;
		bottom = 42;
		plotW = width - left - right;
		plotH = height - top - bottom;

		tempMin = Math.max(0, config.low - 15);
		tempMax = Math.min(120, config.high + 15);
		if (tempMax <= tempMin)
			tempMax = tempMin + 1;

		xForTemp = L.bind(function(temp) {
			return left + (this.clamp(temp, tempMin, tempMax) - tempMin) * plotW / (tempMax - tempMin);
		}, this);

		yForPwm = L.bind(function(pwm) {
			return top + (255 - this.clamp(pwm, 0, 255)) * plotH / 255;
		}, this);

		lowX = xForTemp(config.low);
		highX = xForTemp(config.high);
		minY = yForPwm(config.minPwm);
		maxY = yForPwm(config.maxPwm);

		ctx.fillStyle = '#fafafa';
		ctx.strokeStyle = '#dedede';
		ctx.lineWidth = 1;
		ctx.fillRect(left, top, plotW, plotH);
		ctx.strokeRect(left, top, plotW, plotH);

		ctx.strokeStyle = '#eeeeee';
		ctx.beginPath();
		for (var i = 1; i < 4; i++) {
			ctx.moveTo(left, top + plotH * i / 4);
			ctx.lineTo(left + plotW, top + plotH * i / 4);
			ctx.moveTo(left + plotW * i / 4, top);
			ctx.lineTo(left + plotW * i / 4, top + plotH);
		}
		ctx.stroke();

		ctx.strokeStyle = '#cfcfcf';
		ctx.setLineDash([4, 4]);
		ctx.beginPath();
		ctx.moveTo(lowX, top);
		ctx.lineTo(lowX, top + plotH);
		ctx.moveTo(highX, top);
		ctx.lineTo(highX, top + plotH);
		ctx.stroke();
		ctx.setLineDash([]);

		ctx.strokeStyle = '#2d8a5f';
		ctx.lineWidth = 3;
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';
		ctx.beginPath();
		ctx.moveTo(left, minY);
		ctx.lineTo(lowX, minY);
		ctx.lineTo(highX, maxY);
		ctx.lineTo(left + plotW, maxY);
		ctx.stroke();

		if (config.mode === 'manual') {
			manualY = yForPwm(config.manualPwm);
			ctx.strokeStyle = '#3b7ddd';
			ctx.lineWidth = 2;
			ctx.setLineDash([6, 4]);
			ctx.beginPath();
			ctx.moveTo(left, manualY);
			ctx.lineTo(left + plotW, manualY);
			ctx.stroke();
			ctx.setLineDash([]);
		}

		if (!isNaN(config.currentTemp)) {
			if (isNaN(config.currentPwm))
				config.currentPwm = config.mode === 'manual'
					? config.manualPwm
					: this.pwmAtTemp(config.currentTemp, config.low, config.high, config.minPwm, config.maxPwm);

			currentX = xForTemp(config.currentTemp);
			currentY = yForPwm(config.currentPwm);
			ctx.fillStyle = '#d14545';
			ctx.beginPath();
			ctx.arc(currentX, currentY, 5, 0, Math.PI * 2);
			ctx.fill();
		}

		ctx.fillStyle = '#666';
		ctx.font = '12px sans-serif';
		ctx.textBaseline = 'middle';
		ctx.fillText('255', 18, top);
		ctx.fillText('0', 28, top + plotH);
		ctx.fillText('PWM', left + plotW - 30, top + 12);
		ctx.textBaseline = 'top';
		ctx.fillText(_('%s 掳C').format(tempMin), left, top + plotH + 12);
		ctx.fillText(_('%s 掳C').format(config.low), lowX - 18, top + plotH + 12);
		ctx.fillText(_('%s 掳C').format(config.high), highX - 18, top + plotH + 12);
		ctx.fillText(_('%s 掳C').format(tempMax), left + plotW - 42, top + plotH + 12);
		ctx.fillText(_('娓╁害'), left + plotW - 28, top + plotH + 28);
	},

	curvePanel: function(data) {
		var mode = data.mode || 'auto';
		var low = this.toNum(data.low_temp, 45);
		var high = this.toNum(data.high_temp, 70);
		var minPwm = this.toNum(data.min_pwm, 80);
		var maxPwm = this.toNum(data.max_pwm, 255);
		var manualPwm = this.toNum(data.manual_pwm, 160);
		var currentTemp = this.normalizeTemp(data.cpu_temp || data.temp_value, NaN);
		var currentPwm = this.toNum(data.pwm_value, NaN);
		var left = 48, top = 18, width = 360, height = 150;
		var tempMin, tempMax, points, marker, manualLine, modeText;
		var children = [];

		low = this.clamp(low, 0, 120);
		high = this.clamp(high, 1, 120);
		minPwm = this.clamp(minPwm, 0, 255);
		maxPwm = this.clamp(maxPwm, 0, 255);
		manualPwm = this.clamp(manualPwm, 0, 255);

		if (high <= low)
			high = low + 1;

		tempMin = Math.max(0, low - 15);
		tempMax = Math.min(120, high + 15);

		if (tempMax <= tempMin)
			tempMax = tempMin + 1;

		points = [
			[this.curveX(tempMin, tempMin, tempMax, left, width), this.curveY(minPwm, top, height)],
			[this.curveX(low, tempMin, tempMax, left, width), this.curveY(minPwm, top, height)],
			[this.curveX(high, tempMin, tempMax, left, width), this.curveY(maxPwm, top, height)],
			[this.curveX(tempMax, tempMin, tempMax, left, width), this.curveY(maxPwm, top, height)]
		].map(function(p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ');

		if (!isNaN(currentTemp)) {
			if (isNaN(currentPwm))
				currentPwm = mode === 'manual' ? manualPwm : this.pwmAtTemp(currentTemp, low, high, minPwm, maxPwm);

			marker = E('circle', {
				cx: this.curveX(currentTemp, tempMin, tempMax, left, width),
				cy: this.curveY(currentPwm, top, height),
				r: 5,
				fill: '#d14545'
			});
		}

		if (mode === 'manual') {
			manualLine = E('line', {
				id: 'h5000m-fan-manual-line',
				x1: left,
				y1: this.curveY(manualPwm, top, height),
				x2: left + width,
				y2: this.curveY(manualPwm, top, height),
				stroke: '#3b7ddd',
				'stroke-width': 2,
				'stroke-dasharray': '6 4'
			});
			modeText = _('手动模式：滑杆数值作为固定 PWM 输出。');
		} else if (mode === 'off') {
			modeText = _('关闭模式：风扇 PWM 输出为 0。');
		} else {
			modeText = _('自动模式：低温使用最低 PWM，高温使用最高 PWM，中间线性递增。');
		}

		children.push(E('rect', { x: left, y: top, width: width, height: height, fill: '#fafafa', stroke: '#e5e5e5' }));
		children.push(E('line', { x1: left, y1: top + height, x2: left + width, y2: top + height, stroke: '#888' }));
		children.push(E('line', { x1: left, y1: top, x2: left, y2: top + height, stroke: '#888' }));
		children.push(E('text', { x: 10, y: top + 6, 'font-size': 11, fill: '#666' }, '255'));
		children.push(E('text', { x: 22, y: top + height, 'font-size': 11, fill: '#666' }, '0'));
		children.push(E('text', { x: left, y: top + height + 20, 'font-size': 11, fill: '#666' }, _('%s °C').format(tempMin)));
		children.push(E('text', { x: left + width - 42, y: top + height + 20, 'font-size': 11, fill: '#666' }, _('%s °C').format(tempMax)));
		children.push(E('text', { x: left + width - 54, y: top + 12, 'font-size': 11, fill: '#666' }, 'PWM'));
		children.push(E('text', { x: left + width - 38, y: top + height + 36, 'font-size': 11, fill: '#666' }, _('温度')));
		children.push(E('line', { x1: this.curveX(low, tempMin, tempMax, left, width), y1: top, x2: this.curveX(low, tempMin, tempMax, left, width), y2: top + height, stroke: '#d6d6d6', 'stroke-dasharray': '4 4' }));
		children.push(E('line', { x1: this.curveX(high, tempMin, tempMax, left, width), y1: top, x2: this.curveX(high, tempMin, tempMax, left, width), y2: top + height, stroke: '#d6d6d6', 'stroke-dasharray': '4 4' }));
		children.push(E('text', { x: this.curveX(low, tempMin, tempMax, left, width) - 14, y: top + height + 20, 'font-size': 11, fill: '#666' }, _('%s °C').format(low)));
		children.push(E('text', { x: this.curveX(high, tempMin, tempMax, left, width) - 14, y: top + height + 20, 'font-size': 11, fill: '#666' }, _('%s °C').format(high)));
		children.push(E('polyline', { points: points, fill: 'none', stroke: '#2d8a5f', 'stroke-width': 3, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));

		if (manualLine)
			children.push(manualLine);
		if (marker)
			children.push(marker);

		var canvasId = 'h5000m-fan-curve-canvas';
		var self = this;
		var canvasConfig = {
			mode: mode,
			low: low,
			high: high,
			minPwm: minPwm,
			maxPwm: maxPwm,
			manualPwm: manualPwm,
			currentTemp: currentTemp,
			currentPwm: currentPwm
		};

		window.h5000mFanCurveDraw = function(nextManualPwm) {
			if (typeof nextManualPwm === 'number') {
				canvasConfig.mode = 'manual';
				canvasConfig.manualPwm = nextManualPwm;
				canvasConfig.currentPwm = nextManualPwm;
			}
			self.drawCurveCanvas(canvasId, canvasConfig);
		};

		window.setTimeout(function() {
			window.h5000mFanCurveDraw();
		}, 0);

		return E('div', { 'class': 'h5000m-fan-curve' }, [
			E('h3', _('风扇曲线')),
			E('div', { 'class': 'h5000m-fan-curve-box' }, [
				E('canvas', { id: canvasId, 'class': 'h5000m-fan-curve-canvas', width: '720', height: '240' }),
				E('div', { 'class': 'h5000m-fan-legend' }, [
					E('span', [ E('span', { 'class': 'h5000m-fan-swatch', style: 'background:#2d8a5f' }), _('自动曲线') ]),
					mode === 'manual' ? E('span', [ E('span', { 'class': 'h5000m-fan-swatch', style: 'background:#3b7ddd' }), _('手动 PWM') ]) : null,
					marker ? E('span', [ E('span', { 'class': 'h5000m-fan-swatch', style: 'background:#d14545' }), _('当前状态') ]) : null
				]),
				E('div', { 'class': 'h5000m-fan-note' }, modeText)
			])
		]);
	},

	renderManualPwmWidget: function(option) {
		option.renderWidget = function(section_id, option_index, cfgvalue) {
			var value = cfgvalue || this.default || '160';
			var inputId = this.cbid(section_id);
			var rangeId = inputId + '-range';
			var numberId = inputId + '-number';
			var updateCurve = function(next) {
				var pwm = Math.max(0, Math.min(255, parseInt(next, 10) || 0));

				if (window.h5000mFanCurveDraw)
					window.h5000mFanCurveDraw(pwm);
			};

			return E('div', { 'class': 'h5000m-fan-slider' }, [
				E('input', {
					id: rangeId,
					type: 'range',
					min: '0',
					max: '255',
					step: '1',
					value: value,
					oninput: function(ev) {
						var text = document.getElementById(inputId);
						var number = document.getElementById(numberId);

						if (text)
							text.value = ev.target.value;
						if (number)
							number.value = ev.target.value;
						updateCurve(ev.target.value);
					}
				}),
				E('input', {
					id: numberId,
					type: 'number',
					min: '0',
					max: '255',
					step: '1',
					value: value,
					oninput: function(ev) {
						var range = document.getElementById(rangeId);
						var text = document.getElementById(inputId);

						if (range)
							range.value = ev.target.value;
						if (text)
							text.value = ev.target.value;
						updateCurve(ev.target.value);
					}
				}),
				E('input', {
					id: inputId,
					name: inputId,
					type: 'hidden',
					value: value
				})
			]);
		};
	},

	render: function(res) {
		var m, s, o;
		var status = this.parseStatus(res);

		m = new form.Map('h5000m_fancontrol', _('风扇控制'));
		m.description = _('调节 PWM 风扇策略。');

		s = m.section(form.NamedSection, 'settings', 'settings');
		s.anonymous = true;

		o = s.option(form.Flag, 'enabled', _('启用'));
		o.default = '1';
		o.rmempty = false;

		o = s.option(form.ListValue, 'mode', _('模式'));
		o.value('auto', _('自动'));
		o.value('manual', _('手动'));
		o.value('off', _('关闭'));
		o.default = 'auto';
		o.rmempty = false;

		o = s.option(form.Value, 'manual_pwm', _('手动 PWM'));
		o.datatype = 'range(0,255)';
		o.default = '160';
		this.renderManualPwmWidget(o);

		o = s.option(form.Value, 'min_pwm', _('最低 PWM'));
		o.datatype = 'range(0,255)';
		o.default = '80';

		o = s.option(form.Value, 'max_pwm', _('最高 PWM'));
		o.datatype = 'range(0,255)';
		o.default = '255';

		o = s.option(form.Value, 'low_temp', _('低温阈值'));
		o.datatype = 'range(0,120)';
		o.default = '45';

		o = s.option(form.Value, 'high_temp', _('高温阈值'));
		o.datatype = 'range(1,120)';
		o.default = '70';

		o = s.option(form.Value, 'interval', _('刷新间隔'));
		o.datatype = 'range(5,300)';
		o.default = '15';

		m.handleSaveApply = function(ev, mode) {
			return form.Map.prototype.handleSaveApply.apply(this, [ ev, mode ]).then(function() {
				return fs.exec('/usr/sbin/h5000m-fancontrol', [ 'apply' ]).then(function() {
					return fs.exec('/etc/init.d/h5000m-fancontrol', [ 'restart' ]);
				}).then(function() {
					ui.addNotification(null, E('p', _('风扇控制已应用。')));
				}, function(err) {
					ui.addNotification(null, E('p', _('风扇控制应用失败：') + err.message), 'danger');
				});
			});
		};

		return m.render().then(L.bind(function(node) {
			return E('div', {}, [
				this.styleNode(),
				this.statusPanel(status),
				this.curvePanel(status),
				node
			]);
		}, this));
	}
});
