"""Smoke visual opcional: requer Playwright Python + /usr/bin/google-chrome e ingest local.
PORT=3189 npm start; python3 scripts/check-local-panel.py
Variáveis: MONITOR_URL, SCREENSHOT_DIR (padrão /tmp, fora do git).
"""
from playwright.sync_api import sync_playwright
import os
BASE = os.environ.get("MONITOR_URL", "http://localhost:3189")
SHOTS = os.environ.get("SCREENSHOT_DIR", "/tmp")
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/google-chrome',headless=True,args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1440,'height':1000},locale='pt-BR')
 errors=[]; requests=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('request',lambda r:requests.append(r.url))
 page.goto(BASE,wait_until='networkidle')
 assert not any('br-ufs.geojson' in u or 'us-states.geojson' in u for u in requests)
 # Enter no polígono abre o painel e carrega estados sob demanda.
 page.locator('#map [data-country="BR"]').focus()
 page.keyboard.press('Enter')
 page.wait_for_selector('#map .states path')
 assert page.locator('#map .states path').count()==27
 assert 'local=BR' in page.url
 assert page.locator('#local-panel').is_visible()
 assert page.locator('#local-items .card').count()>0
 page.screenshot(path=SHOTS + '/painel-local-desktop.png')
 page.locator('#local-filters [data-kind="cyber"]').click()
 assert page.locator('#local-filters [data-kind="cyber"]').get_attribute('aria-pressed')=='true'
 page.keyboard.press('Escape')
 assert page.locator('#local-panel').is_hidden()
 assert 'local=' not in page.url
 assert page.locator('#map [data-country="BR"]').evaluate('(e)=>e===document.activeElement')
 # Clique em UF, tradução e navegação ao país.
 page.goto(BASE + '/?local=BR',wait_until='networkidle')
 point=page.evaluate('''() => { const path=document.querySelector('#map [data-state="RR"]'); const b=path.getBoundingClientRect(); for(let y=b.y;y<b.bottom;y+=2) for(let x=b.x;x<b.right;x+=2) if(document.elementFromPoint(x,y)===path) return {x,y}; throw Error('No exposed RR point'); }''')
 page.mouse.click(point['x'],point['y'])
 assert 'local=BR-RR' in page.url
 assert 'BR-RR' in page.locator('#local-title').inner_text()
 for lang,word in [('en','Local incidents'),('es','Incidentes locales'),('pt','Ocorrências locais')]:
  page.locator(f'[data-lang="{lang}"]').click()
  assert page.locator('#local-eyebrow').inner_text()==word
 page.locator('#local-parent').click()
 assert 'local=BR' in page.url and 'BR-RR' not in page.url
 page.goto(BASE + '/#US-AZ',wait_until='networkidle')
 assert page.locator('#map .states path').count()==51
 assert 'US-AZ' in page.locator('#local-title').inner_text()
 # Cluster usa o mesmo painel e limpa seleção local da URL.
 page.keyboard.press('Escape')
 page.locator('#map .marker').first.click(force=True)
 assert 'Pontos agrupados' in page.locator('#local-title').inner_text()
 assert page.locator('#local-items .card').count()>0
 assert 'local=' not in page.url
 mobile=browser.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,locale='pt-BR')
 mobile.goto(BASE + '/?local=BR-SP',wait_until='networkidle')
 mobile.wait_for_selector('#map .states path')
 assert mobile.locator('#local-panel').is_visible()
 assert mobile.locator('#local-items .card').count()>0
 assert mobile.locator('#local-panel').bounding_box()['y']>0
 assert mobile.evaluate('document.documentElement.scrollWidth <= innerWidth')
 mobile.screenshot(path=SHOTS + '/painel-local-mobile.png')
 assert not errors,errors
 print('OK: lazy load, país, UF, EUA, cluster, URL/hash, filtros, i18n, Escape/foco, mobile e prints')
 browser.close()
