(function () {
	/* Google Reviews: 4-line clamp with expand (linkable mode only) + auto-advancing carousel */
	function initReviews() {
		document.querySelectorAll('.rev-carousel').forEach(function (carousel) {
			var linkable = carousel.getAttribute('data-linkable') === '1';
			var track = carousel.querySelector('.rev-track');
			var cards = Array.prototype.slice.call(carousel.querySelectorAll('.rev-card'));
			if (!track || !cards.length) return;

			// "Read more" only where the text actually overflows the 4-line clamp.
			if (linkable) {
				cards.forEach(function (card) {
					var text = card.querySelector('.rev-text');
					if (!text || text.scrollHeight <= text.clientHeight + 2) return;
					var btn = document.createElement('button');
					btn.type = 'button';
					btn.className = 'rev-more';
					btn.textContent = 'Read more';
					btn.addEventListener('click', function () {
						var open = text.classList.toggle('expanded');
						btn.textContent = open ? 'Read less' : 'Read more';
					});
					text.after(btn);
				});
			}

			// Dots + auto-advance (pause on hover/touch).
			var dotsWrap = carousel.querySelector('.rev-dots');
			var dots = [];
			if (dotsWrap) {
				cards.forEach(function (_, i) {
					var d = document.createElement('button');
					d.setAttribute('aria-label', 'Review ' + (i + 1));
					d.addEventListener('click', function () { go(i); });
					dotsWrap.appendChild(d);
					dots.push(d);
				});
			}
			var idx = 0;
			function markActive() {
				var pos = track.scrollLeft;
				var w = cards[0].offsetWidth + 22;
				idx = Math.round(pos / w);
				dots.forEach(function (d, i) { d.classList.toggle('active', i === idx); });
			}
			function go(i) {
				var w = cards[0].offsetWidth + 22;
				var max = track.scrollWidth - track.clientWidth;
				track.scrollTo({ left: Math.min(i * w, max), behavior: 'smooth' });
			}
			track.addEventListener('scroll', function () { window.requestAnimationFrame(markActive); });
			markActive();

			var paused = false;
			carousel.addEventListener('mouseenter', function () { paused = true; });
			carousel.addEventListener('mouseleave', function () { paused = false; });
			carousel.addEventListener('touchstart', function () { paused = true; }, { passive: true });
			setInterval(function () {
				if (paused || document.hidden) return;
				var w = cards[0].offsetWidth + 22;
				var max = track.scrollWidth - track.clientWidth;
				var next = (track.scrollLeft >= max - 4) ? 0 : Math.min((idx + 1) * w, max);
				track.scrollTo({ left: next, behavior: 'smooth' });
			}, 5000);
		});
	}
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', initReviews);
	} else {
		initReviews();
	}

	var toggle = document.getElementById('ibcNavToggle');
	var nav = document.getElementById('ibcNav');
	if (toggle && nav) {
		toggle.addEventListener('click', function () {
			var open = nav.classList.toggle('open');
			toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
		});
		nav.addEventListener('click', function (e) {
			if (e.target.tagName === 'A') {
				nav.classList.remove('open');
			}
		});
	}
})();

/* Limited-time quarterly offer popup */
(function () {
	var modal = document.getElementById('ibcOfferModal');
	if (!modal) return;
	var KEY = 'ibc_offer_seen';
	function open() { modal.hidden = false; document.body.style.overflow = 'hidden'; }
	function close() {
		modal.hidden = true;
		document.body.style.overflow = '';
		try { localStorage.setItem(KEY, String(Date.now())); } catch (e) {}
	}
	modal.addEventListener('click', function (e) {
		if (e.target.hasAttribute && e.target.hasAttribute('data-close')) close();
	});
	document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !modal.hidden) close(); });
	document.addEventListener('click', function (e) {
		var btn = e.target.closest && e.target.closest('.js-open-offer');
		if (btn) { e.preventDefault(); open(); }
	});
	var seen = false;
	try {
		var sv = localStorage.getItem(KEY);
		if (sv === 'done') { seen = true; } /* legacy '1' values are ignored so the popup returns */
		else if (sv && Date.now() - parseInt(sv, 10) < 86400000) { seen = true; }
	} catch (e) {}
	if (!seen) setTimeout(open, 2600);

	var form = modal.querySelector('.ibc-offer-form');
	form.addEventListener('submit', function (e) {
		e.preventDefault();
		var email = form.querySelector('input[type=email]').value.trim();
		var err = modal.querySelector('.ibc-offer-err');
		if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { err.hidden = false; return; }
		err.hidden = true;
		function reveal() {
			modal.querySelector('[data-step=form]').hidden = true;
			modal.querySelector('[data-step=done]').hidden = false;
				try { localStorage.setItem(KEY, 'done'); } catch (e) {}
		}
		var endpoint = modal.getAttribute('data-endpoint');
		if (!endpoint) { reveal(); return; } /* static preview: demo mode */
		var data = new FormData();
		data.append('action', 'ibc_offer');
		data.append('email', email);
		data.append('page', window.location.href);
		data.append('ibc_website', form.querySelector('[name=ibc_website]') ? form.querySelector('[name=ibc_website]').value : '');
		fetch(endpoint, { method: 'POST', body: data })
			.then(function (r) { return r.json(); })
			.then(function (j) { if (j && j.ok) { reveal(); } else { err.textContent = 'Please enter a valid email address.'; err.hidden = false; } })
			.catch(function () { reveal(); }); /* never strand the visitor: show the code even if the save failed */
	});
})();

/* Corner chat widget — info topics + step-by-step signup flow */
(function () {
	var root = document.getElementById('ibcChat');
	if (!root) return;
	var bubble = root.querySelector('.ibc-chat-bubble');
	var panel = root.querySelector('.ibc-chat-panel');
	var body = root.querySelector('.ibc-chat-body');
	var chipsWrap = root.querySelector('.ibc-chat-chips');
	var d = function (k) { return root.getAttribute('data-' + k) || ''; };
	var endpoint = d('endpoint');
	var areas = d('areas');
	var P = {
		month: parseInt(d('price-month'), 10) || 30,
		quart: parseInt(d('price-quart'), 10) || 45,
		once: parseInt(d('price-once'), 10) || 65,
		regQuart: parseInt(d('regular-quart'), 10) || 60,
		regOnce: parseInt(d('regular-once'), 10) || 75
	};
	var CHECKOUT = { month: d('checkout-month'), quart: d('checkout-quart') };
	var howUrl = d('how-url');
	var lead = {};
	var started = false;

	function el(tag, cls, html) {
		var n = document.createElement(tag);
		if (cls) n.className = cls;
		if (html !== undefined) n.innerHTML = html;
		return n;
	}
	function scrollDown() { body.scrollTop = body.scrollHeight; }
	function userSay(text) { body.appendChild(el('div', 'ibc-msg user', text)); scrollDown(); }
	function setChips(list) {
		chipsWrap.innerHTML = '';
		(list || []).forEach(function (c) {
			var b = el('button', 'ibc-chip' + (c.primary ? ' primary' : ''), c.label);
			b.type = 'button';
			b.addEventListener('click', function () { c.run(); });
			chipsWrap.appendChild(b);
		});
	}
	function botSay(html, after) {
		var t = el('div', 'ibc-typing', '<i></i><i></i><i></i>');
		body.appendChild(t);
		scrollDown();
		setTimeout(function () {
			t.remove();
			body.appendChild(el('div', 'ibc-msg bot', html));
			scrollDown();
			if (after) after();
		}, 480);
	}

	/* ---------- info topics ---------- */
	function topicChips() {
		return [
			{ label: '🚀 Get Started', primary: true, run: startSignup },
			{ label: '💰 Pricing & plans', run: function () {
				userSay('Pricing & plans');
				botSay('<b>Monthly Clean</b> — $' + P.month + ' every 4 weeks<br><b>Quarterly Clean</b> — <s style="color:#c0392b">$' + P.regQuart + '</s> $' + P.quart + ' every 12 weeks (limited-time)<br><b>On-Demand Clean</b> — <s style="color:#c0392b">$' + P.regOnce + '</s> $' + P.once + ' one time (limited-time)<br><br>All plans include 2 bins — $10 for each additional bin.', offerStart);
			} },
			{ label: '🗺️ Service area', run: function () {
				userSay('Do you service my area?');
				botSay('We currently serve:<br><b>' + areas + '</b><br><br>Close but not on the list? Get started anyway and drop your ZIP — we add routes as neighborhoods fill up!', offerStart);
			} },
			{ label: '🧽 How it works', run: function () {
				userSay('How does it work?');
				botSay('Easy as 1-2-3:<br><b>1.</b> Sign up online — pick a plan.<br><b>2.</b> We come the day after your trash pickup and deep-clean your bins curbside with 200° pressurized hot water.<br><b>3.</b> We sanitize, deodorize, and put them back where they belong.' + (howUrl && howUrl !== '#' ? '<br><a class="btn btn-blue" href="' + howUrl + '">Learn more</a>' : ''), offerStart);
			} }
		];
	}
	function offerStart() {
		var wrap = el('div', 'ibc-msg bot', 'Ready when you are! 👇<br>');
		var b = el('button', 'btn btn-primary', 'Get Started');
		b.type = 'button';
		b.addEventListener('click', startSignup);
		wrap.appendChild(b);
		body.appendChild(wrap);
		scrollDown();
		setChips(topicChips());
	}

	/* ---------- step-by-step signup ---------- */
	function askInput(opts) {
		botSay(opts.question, function () {
			chipsWrap.innerHTML = '';
			var f = el('form', 'ibc-chat-inputrow');
			f.innerHTML = '<input type="' + (opts.type || 'text') + '" placeholder="' + opts.placeholder + '" autocomplete="' + (opts.autocomplete || 'on') + '"' + (opts.inputmode ? ' inputmode="' + opts.inputmode + '"' : '') + ' required><button type="submit" class="btn btn-primary" aria-label="Send">➤</button>';
			var input = f.querySelector('input');
			f.addEventListener('submit', function (e) {
				e.preventDefault();
				var v = input.value.trim();
				var err = opts.validate ? opts.validate(v) : '';
				if (err) {
					botSay(err);
					return;
				}
				userSay(v);
				chipsWrap.innerHTML = '';
				opts.next(v);
			});
			chipsWrap.appendChild(f);
			input.focus();
		});
		setChips([]);
	}

	function startSignup() {
		userSay('Get Started');
		askInput({
			question: 'Awesome! 🎉 To start, what&rsquo;s your first and last name?',
			placeholder: 'First and last name',
			autocomplete: 'name',
			validate: function (v) { return v.length < 2 ? 'Please enter your name so we know who to greet. 😊' : ''; },
			next: function (v) { lead.name = v; askPhone(); }
		});
	}
	function askPhone() {
		askInput({
			question: 'Thanks, ' + lead.name.split(' ')[0] + '! What&rsquo;s the best phone number to text you at?',
			placeholder: 'Phone number',
			type: 'tel',
			inputmode: 'tel',
			autocomplete: 'tel',
			validate: function (v) { return v.replace(/\D/g, '').length < 10 ? 'That number looks short — please enter a 10-digit phone number.' : ''; },
			next: function (v) { lead.phone = v; askEmail(); }
		});
	}
	function askEmail() {
		askInput({
			question: 'Got it. What&rsquo;s your email address?',
			placeholder: 'Email address',
			type: 'email',
			autocomplete: 'email',
			validate: function (v) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) ? '' : 'Hmm, that email doesn&rsquo;t look right — mind double-checking it?'; },
			next: function (v) { lead.email = v; askZip(); }
		});
	}
	function askZip() {
		askInput({
			question: 'Almost done! What&rsquo;s your ZIP code?',
			placeholder: 'ZIP code',
			inputmode: 'numeric',
			autocomplete: 'postal-code',
			validate: function (v) { return /^\d{5}$/.test(v.trim()) ? '' : 'Please enter a 5-digit ZIP code.'; },
			next: function (v) { lead.zip = v; askService(); }
		});
	}
	function askService() {
		botSay('Last question — what service are you interested in?', function () {
			setChips([
				{ label: '⭐ Quarterly Clean — $' + P.quart + '/quarter', primary: true, run: function () { chooseService('quart'); } },
				{ label: 'Monthly Clean — $' + P.month + '/month', run: function () { chooseService('month'); } }
			]);
		});
		setChips([]);
	}
	function chooseService(plan) {
		var label = plan === 'quart' ? 'Quarterly Clean' : 'Monthly Clean';
		userSay(label);
		lead.service = label;
		/* open checkout synchronously so popup blockers allow it */
		var win = window.open(CHECKOUT[plan], '_blank');
		submitLead();
		botSay('Perfect, ' + lead.name.split(' ')[0] + '! 🎉 Taking you to the secure <b>' + label + '</b> signup page now — that&rsquo;s where you&rsquo;ll enter payment info and pick your service address.' + '<br><a class="btn btn-primary" href="' + CHECKOUT[plan] + '" target="_blank" rel="noopener">Open signup page</a>', function () {
			setChips([{ label: '🔄 Start over', run: function () { lead = {}; greet(); } }]);
		});
		if (win) { try { win.opener = null; } catch (e) {} }
	}
	function submitLead() {
		if (!endpoint) return; /* static preview: demo mode */
		var data = new FormData();
		data.append('action', 'ibc_chat');
		data.append('name', lead.name || '');
		data.append('contact', lead.phone || '');
		data.append('message', 'CHAT SIGNUP\nEmail: ' + (lead.email || '') + '\nZIP: ' + (lead.zip || '') + '\nService chosen: ' + (lead.service || '') + '\n(Visitor was sent to the ' + (lead.service || '') + ' checkout page — confirm signup in iRoutes.)');
		data.append('page', window.location.href);
		data.append('ibc_website', '');
		fetch(endpoint, { method: 'POST', body: data }).catch(function () {});
	}

	/* ---------- open/close ---------- */
	function greet() {
		botSay('👋 Hi there! Smelly bins? We can fix that. Tap a topic below — or hit <b>Get Started</b> to sign up in under a minute.', function () {
			setChips(topicChips());
		});
	}
	function start() {
		if (started) return;
		started = true;
		greet();
	}
	function setOpen(open) {
		root.classList.toggle('open', open);
		panel.hidden = !open;
		bubble.setAttribute('aria-expanded', open ? 'true' : 'false');
		if (open) {
			root.classList.remove('nudge');
			try { sessionStorage.setItem('ibc_chat_nudged', '1'); } catch (e) {}
			start();
		}
	}
	bubble.addEventListener('click', function () { setOpen(panel.hidden); });
	root.querySelector('.ibc-chat-x').addEventListener('click', function () { setOpen(false); });
	document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) setOpen(false); });

	/* Soft two-note chime (Web Audio — no sound file). Browsers only allow
	   audio after the visitor's first tap/click/keypress, so if the nudge
	   fires before any interaction we play at their first gesture instead. */
	function playDing() {
		try {
			var Ctx = window.AudioContext || window.webkitAudioContext;
			if (!Ctx) return;
			var ctx = new Ctx();
			var play = function () {
				[[830, 0], [1245, 0.14]].forEach(function (n) {
					var o = ctx.createOscillator();
					var g = ctx.createGain();
					o.type = 'sine';
					o.frequency.value = n[0];
					var t = ctx.currentTime + n[1];
					g.gain.setValueAtTime(0, t);
					g.gain.linearRampToValueAtTime(0.08, t + 0.02);
					g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
					o.connect(g).connect(ctx.destination);
					o.start(t);
					o.stop(t + 0.6);
				});
				setTimeout(function () { ctx.close(); }, 1200);
			};
			if (ctx.state === 'suspended') {
				var unlock = function () {
					['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) { document.removeEventListener(ev, unlock); });
					if (!panel.hidden) { ctx.close(); return; } /* already chatting — skip */
					ctx.resume().then(play).catch(function () {});
				};
				['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) { document.addEventListener(ev, unlock, { once: false }); });
			} else {
				play();
			}
		} catch (e) {}
	}

	function showTeaser() {
		if (root.querySelector('.ibc-chat-teaser')) return;
		var t = el('div', 'ibc-chat-teaser');
		t.innerHTML = '<button class="ibc-teaser-x" aria-label="Dismiss">&times;</button>\ud83d\udc4b <b>Need help?</b><br>Get a quote &amp; sign up in under a minute \u2014 chat with us!';
		t.addEventListener('click', function (e) {
			if (e.target.classList.contains('ibc-teaser-x')) { t.remove(); return; }
			t.remove();
			setOpen(true);
		});
		root.insertBefore(t, bubble);
	}
	function clearTeaser() {
		var t = root.querySelector('.ibc-chat-teaser');
		if (t) t.remove();
	}
	bubble.addEventListener('click', clearTeaser);

	var nudged = false;
	try { nudged = sessionStorage.getItem('ibc_chat_nudged') === '1'; } catch (e) {}
	if (!nudged) {
		setTimeout(function () {
			if (panel.hidden) {
				root.classList.add('nudge');
				showTeaser();
				playDing();
			}
			try { sessionStorage.setItem('ibc_chat_nudged', '1'); } catch (e) {}
		}, 6000);
	}
})();

/* Draggable before/after sliders */
(function () {
	var sliders = document.querySelectorAll('.ba-slider');
	if (!sliders.length) return;
	sliders.forEach(function (s) {
		var top = s.querySelector('.ba-top');
		var line = s.querySelector('.ba-line');
		var img = top.querySelector('img');
		function sizeInner() { img.style.width = s.offsetWidth + 'px'; }
		function setPct(p) {
			p = Math.max(6, Math.min(94, p));
			top.style.width = p + '%';
			line.style.left = p + '%';
		}
		function fromEvent(e) {
			var r = s.getBoundingClientRect();
			var x = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
			setPct((x / r.width) * 100);
		}
		var dragging = false;
		s.addEventListener('pointerdown', function (e) { dragging = true; s.setPointerCapture(e.pointerId); fromEvent(e); });
		s.addEventListener('pointermove', function (e) { if (dragging) fromEvent(e); });
		s.addEventListener('pointerup', function () { dragging = false; });
		s.addEventListener('pointercancel', function () { dragging = false; });
		window.addEventListener('resize', sizeInner);
		sizeInner();
		setPct(55);
	});
})();
