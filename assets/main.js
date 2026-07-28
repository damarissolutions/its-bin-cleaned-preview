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
		try { localStorage.setItem(KEY, '1'); } catch (e) {}
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
	try { seen = localStorage.getItem(KEY) === '1'; } catch (e) {}
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
			try { localStorage.setItem(KEY, '1'); } catch (e) {}
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

/* Corner chat widget — scripted assistant + message capture */
(function () {
	var root = document.getElementById('ibcChat');
	if (!root) return;
	var bubble = root.querySelector('.ibc-chat-bubble');
	var panel = root.querySelector('.ibc-chat-panel');
	var body = root.querySelector('.ibc-chat-body');
	var chipsWrap = root.querySelector('.ibc-chat-chips');
	var endpoint = root.getAttribute('data-endpoint') || '';
	var areas = root.getAttribute('data-areas') || '';
	var pricing = root.getAttribute('data-pricing') || '';
	var pricingUrl = root.getAttribute('data-pricing-url') || '#pricing';
	var howUrl = root.getAttribute('data-how-url') || '#how';
	var started = false;

	function el(tag, cls, html) {
		var n = document.createElement(tag);
		if (cls) n.className = cls;
		if (html !== undefined) n.innerHTML = html;
		return n;
	}
	function scrollDown() { body.scrollTop = body.scrollHeight; }
	function userSay(text) {
		body.appendChild(el('div', 'ibc-msg user', text));
		scrollDown();
	}
	function botSay(html, instant) {
		if (instant) {
			var m = el('div', 'ibc-msg bot', html);
			body.appendChild(m);
			scrollDown();
			return m;
		}
		var t = el('div', 'ibc-typing', '<i></i><i></i><i></i>');
		body.appendChild(t);
		scrollDown();
		setTimeout(function () {
			t.remove();
			body.appendChild(el('div', 'ibc-msg bot', html));
			scrollDown();
		}, 520);
	}

	var topics = [
		{ label: '💰 Pricing & plans', run: function () {
			userSay('Pricing & plans');
			botSay(pricing.replace(/\n/g, '<br>') + '<br><a class="btn btn-primary" href="' + pricingUrl + '">See plans &amp; book</a>');
		} },
		{ label: '🗺️ Service area', run: function () {
			userSay('Do you service my area?');
			botSay('We currently serve:<br><b>' + areas + '</b><br><br>Not on the list? Leave us a message with your city/ZIP and we’ll check your address — sometimes we can make it work!');
		} },
		{ label: '🧽 How it works', run: function () {
			userSay('How does it work?');
			botSay('Easy as 1-2-3:<br><b>1.</b> Sign up online — pick a plan.<br><b>2.</b> We come the day after your trash pickup and deep-clean your bins curbside with 200° pressurized hot water.<br><b>3.</b> We sanitize, deodorize, and put them back where they belong.<br><a class="btn btn-blue" href="' + howUrl + '">Learn more</a>');
		} },
		{ label: '💬 Leave a message', run: showForm }
	];

	function showForm() {
		userSay('I have a question');
		botSay('Sure — drop your info below and we’ll text you back shortly. 👇', false);
		setTimeout(function () {
			var wrap = el('div', 'ibc-msg bot');
			wrap.appendChild(buildForm());
			body.appendChild(wrap);
			scrollDown();
		}, 620);
	}

	function buildForm() {
		var f = el('form', 'ibc-chat-form');
		f.innerHTML =
			'<input type="text" name="name" placeholder="Your name" required>' +
			'<input type="text" name="contact" placeholder="Phone number (or email)" required>' +
			'<textarea name="message" placeholder="Your question…" required></textarea>' +
			'<input type="text" name="ibc_website" style="position:absolute;left:-9999px" tabindex="-1" autocomplete="off" aria-hidden="true">' +
			'<span class="consent-note">By sending, you agree we may reply by text or email. Msg &amp; data rates may apply. Reply STOP to opt out.</span>' +
			'<span class="ibc-chat-err" hidden>Please fill in all three fields.</span>' +
			'<button type="submit" class="btn btn-primary">Send message</button>';
		f.addEventListener('submit', function (e) {
			e.preventDefault();
			var name = f.name.value.trim(), contact = f.contact.value.trim(), msg = f.message.value.trim();
			var err = f.querySelector('.ibc-chat-err');
			if (!name || !contact || !msg) { err.hidden = false; return; }
			err.hidden = true;
			var btn = f.querySelector('button');
			btn.disabled = true;
			btn.textContent = 'Sending…';
			function done() {
				f.closest('.ibc-msg').remove();
				userSay(msg);
				botSay('Got it, ' + name.split(' ')[0] + '! 🎉 We’ll text you back shortly — usually within the hour during business hours.');
			}
			if (!endpoint) { setTimeout(done, 600); return; } /* static preview: demo mode */
			var data = new FormData();
			data.append('action', 'ibc_chat');
			data.append('name', name);
			data.append('contact', contact);
			data.append('message', msg);
			data.append('page', window.location.href);
			data.append('ibc_website', f.ibc_website.value);
			fetch(endpoint, { method: 'POST', body: data })
				.then(function (r) { return r.json(); })
				.then(function (j) {
					if (j && j.ok) { done(); }
					else { err.textContent = 'Something went wrong — please try again.'; err.hidden = false; btn.disabled = false; btn.textContent = 'Send message'; }
				})
				.catch(function () { done(); }); /* never strand the visitor */
		});
		return f;
	}

	function start() {
		if (started) return;
		started = true;
		botSay('👋 Hi there! Smelly bins? We can fix that. What can we help you with?', true);
		topics.forEach(function (t) {
			var c = el('button', 'ibc-chip', t.label);
			c.type = 'button';
			c.addEventListener('click', t.run);
			chipsWrap.appendChild(c);
		});
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

	/* attention nudge once per session */
	var nudged = false;
	try { nudged = sessionStorage.getItem('ibc_chat_nudged') === '1'; } catch (e) {}
	if (!nudged) {
		setTimeout(function () {
			if (panel.hidden) root.classList.add('nudge');
			try { sessionStorage.setItem('ibc_chat_nudged', '1'); } catch (e) {}
		}, 6000);
	}
})();
