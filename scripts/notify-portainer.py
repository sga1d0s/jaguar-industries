"""Invoca el webhook privado sin mostrar su URL ni el contenido de la respuesta."""
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None

def notify(url):
    parsed = urllib.parse.urlsplit(url)
    if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password or parsed.fragment:
        raise ValueError('Configura un webhook HTTPS válido en PORTAINER_STACK_WEBHOOK.')
    opener = urllib.request.build_opener(NoRedirect())
    for attempt in range(3):
        try:
            request = urllib.request.Request(url, data=b'{}', method='POST', headers={'Content-Type': 'application/json'})
            with opener.open(request, timeout=30) as response:
                if response.status != 204:
                    raise ValueError(f'El webhook respondió HTTP {response.status}; se esperaba 204 de Portainer.')
            print('Portainer ha aceptado el webhook (204). Falta comprobar la versión servida.')
            return
        except urllib.error.HTTPError as error:
            if error.code < 500 and error.code != 429:
                raise ValueError(f'El webhook devolvió HTTP {error.code}. No se muestran su URL ni su respuesta.') from None
        except (urllib.error.URLError, TimeoutError):
            pass
        if attempt < 2:
            time.sleep(5)
    raise ValueError('Portainer no confirmó el webhook tras tres intentos. La versión publicada queda disponible para reintentar.')

if __name__ == '__main__':
    try:
        notify(os.environ.get('PORTAINER_STACK_WEBHOOK', ''))
    except ValueError as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
    except Exception:
        # Un fallo inesperado de red tampoco debe volcar la URL privada en un traceback.
        print('No se pudo invocar el webhook. Revisa el secreto y la conexión con Portainer.', file=sys.stderr)
        sys.exit(1)
