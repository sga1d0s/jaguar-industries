"""Espera a que API y frontal sirvan el commit publicado y PostgreSQL esté listo."""
import argparse
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

def verify(base, revision, timeout=180):
    parsed = urllib.parse.urlsplit(base)
    if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise ValueError('DEPLOY_VERIFY_URL debe ser el origen HTTPS público del panel.')
    deadline = time.monotonic() + timeout
    last = 'Sin respuesta todavía.'
    while time.monotonic() < deadline:
        try:
            values = {}
            for path in ['/api/version', '/version.json', '/api/ready']:
                request = urllib.request.Request(base.rstrip('/') + path, headers={'Cache-Control': 'no-cache'})
                with urllib.request.urlopen(request, timeout=10) as response:
                    values[path] = json.load(response)
            if values['/api/version'].get('revision') == revision and values['/version.json'].get('revision') == revision and values['/api/ready'].get('status') == 'ok':
                print('Despliegue verificado: API y web sirven ' + revision + ' y la base está lista.')
                return
            last = 'La web o la API todavía sirven otra versión.'
        except urllib.error.HTTPError as error:
            last = f'Comprobación pública: HTTP {error.code}.'
        except (urllib.error.URLError, TimeoutError, ValueError, AttributeError):
            last = 'El panel todavía no responde con una versión válida.'
        time.sleep(5)
    raise ValueError(last + ' El webhook aceptado no se considera un despliegue verificado. Revisa el stack, GHCR y la ruta del túnel.')

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', required=True)
    parser.add_argument('--revision', required=True)
    args = parser.parse_args()
    try:
        verify(args.url, args.revision)
    except ValueError as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
