// bleibly · Urheberrecht © 2026 Nawid Hassanabadi · Alle Rechte vorbehalten · proprietär, siehe LICENSE
// Statusseite: fragt die Statusschnittstelle beim Öffnen und jede Minute
// direkt aus dem Browser (stimmt also auch, wenn die Wache aus ist) und
// zeigt die Vorfälle der letzten 90 Tage aus vorfaelle.json.
(function () {
  'use strict';

  var lokal = location.hostname === '127.0.0.1' || location.hostname === 'localhost';
  var QUELLE = lokal ? '/api/status.php' : 'https://bleibly.com/api/status.php';
  var TAKT = 60000;
  var ZEITLIMIT = 10000;
  var TAGE = 90;

  var lage = document.getElementById('lage');
  var titel = document.getElementById('lage-titel');
  var satz = document.getElementById('lage-satz');
  var stand = document.getElementById('stand');
  var knopf = document.getElementById('neu');
  var liste = document.getElementById('liste');

  var offenerVorfall = false;
  var laeuft = false;

  var uhr = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Europe/Berlin' });
  var tagUhr = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' });
  var nurUhr = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' });
  var nurTag = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Berlin' });

  // Die Texte stehen einmal im HTML: unsichtbar im selben Rasterfeld, damit die
  // Karte von Anfang an so hoch ist wie der längste Zustand (nichts springt).
  function zeigen(zustand) {
    var vorlage = document.querySelector('.lage-mass[data-fuer="' + zustand + '"]');
    lage.setAttribute('data-zustand', zustand);
    titel.textContent = vorlage.querySelector('.titel').textContent;
    satz.textContent = vorlage.querySelector('.satz').textContent;
    stand.textContent = 'Zuletzt geprüft: ' + uhr.format(new Date()) + ' Uhr · neu jede Minute';
  }

  function pruefen() {
    if (laeuft) { return; }
    laeuft = true;
    knopf.setAttribute('aria-busy', 'true');
    var abbruch = typeof AbortController === 'function' ? new AbortController() : null;
    var wecker = setTimeout(function () { if (abbruch) { abbruch.abort(); } }, ZEITLIMIT);
    fetch(QUELLE + '?t=' + Date.now(), {
      cache: 'no-store', credentials: 'omit', mode: 'cors', signal: abbruch ? abbruch.signal : undefined
    }).then(function (r) {
      return r.json().catch(function () { return null; }).then(function (d) {
        if (r.status === 429) { return null; }
        return r.status === 200 && d && d.ok === true ? 'ok' : 'gestoert';
      });
    }).catch(function () {
      // keine Antwort: bei offenem Vorfall wissen wir es besser
      return offenerVorfall ? 'gestoert' : 'unbekannt';
    }).then(function (zustand) {
      clearTimeout(wecker);
      laeuft = false;
      knopf.removeAttribute('aria-busy');
      if (zustand) { zeigen(zustand); }
    });
  }

  function zeitraum(beginn, ende) {
    if (!ende) { return 'seit ' + tagUhr.format(beginn) + ' Uhr'; }
    if (nurTag.format(beginn) === nurTag.format(ende)) {
      return tagUhr.format(beginn) + ' bis ' + nurUhr.format(ende) + ' Uhr';
    }
    return tagUhr.format(beginn) + ' Uhr bis ' + tagUhr.format(ende) + ' Uhr';
  }

  function element(tag, klasse, text) {
    var e = document.createElement(tag);
    if (klasse) { e.className = klasse; }
    if (text) { e.textContent = text; }
    return e;
  }

  function vorfaelleZeigen(daten) {
    var grenze = Date.now() - TAGE * 86400000;
    var alle = (daten && Array.isArray(daten.vorfaelle)) ? daten.vorfaelle : [];
    var sichtbar = alle.filter(function (v) {
      var b = Date.parse(v.beginn);
      var e = v.ende ? Date.parse(v.ende) : NaN;
      return !isNaN(b) && (v.zustand === 'offen' || (isNaN(e) ? b : e) >= grenze);
    }).sort(function (a, b) { return Date.parse(b.beginn) - Date.parse(a.beginn); });

    offenerVorfall = sichtbar.some(function (v) { return v.zustand === 'offen'; });
    liste.textContent = '';
    if (!sichtbar.length) {
      liste.appendChild(element('li', 'karte leer', 'Keine Vorfälle in den letzten 90 Tagen.'));
      return;
    }
    sichtbar.forEach(function (v) {
      var offen = v.zustand === 'offen';
      var li = element('li', 'karte vorfall');
      li.setAttribute('data-zustand', offen ? 'offen' : 'behoben');
      var kopf = element('div', 'vorfall-kopf');
      kopf.appendChild(element('h3', '', String(v.titel || 'Störung')));
      kopf.appendChild(element('span', 'marke', offen ? 'Offen' : 'Behoben'));
      li.appendChild(kopf);
      li.appendChild(element('p', 'zeitraum', zeitraum(new Date(v.beginn), v.ende ? new Date(v.ende) : null)));
      if (v.text) { li.appendChild(element('p', 'text', String(v.text))); }
      liste.appendChild(li);
    });
  }

  function vorfaelleLaden() {
    return fetch('vorfaelle.json?t=' + Date.now(), { cache: 'no-store', credentials: 'omit' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; })
      .then(function (d) {
        if (d) { vorfaelleZeigen(d); } else if (liste.querySelector('#leer')) {
          liste.textContent = '';
          liste.appendChild(element('li', 'karte leer', 'Die Vorfälle lassen sich gerade nicht laden.'));
        }
      });
  }

  knopf.addEventListener('click', function () { vorfaelleLaden().then(pruefen); });
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') { pruefen(); }
  });
  vorfaelleLaden().then(pruefen);
  setInterval(function () { vorfaelleLaden().then(pruefen); }, TAKT);
})();
