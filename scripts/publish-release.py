"""Genera y publica el Compose de producción después de publicar ambas imágenes."""
import argparse
import json
import os
import re
import subprocess
import tempfile
from pathlib import Path

BRANCH = 'deploy/production'
MARKER = 'jaguar-github-actions-v1'

def render(template, revision, api_image, web_image):
    """Sustituye únicamente las imágenes; conserva variables, redes y volúmenes."""
    if not re.fullmatch(r'[0-9a-f]{40}', revision):
        raise ValueError('El commit debe ser un SHA completo.')
    for image in (api_image, web_image):
        if not re.fullmatch(r'ghcr\.io/[a-z0-9_.-]+/[a-z0-9_.-]+:sha-' + revision + r'@sha256:[0-9a-f]{64}', image):
            raise ValueError('Cada imagen debe fijar la versión del commit y su digest.')
    result = template
    for variable, image in [('API_IMAGE', api_image), ('WEB_IMAGE', web_image)]:
        result, count = re.subn(r'(?m)^(\s+image: )\$\{' + variable + r':\?[^\n}]+\}$', lambda m: m[1] + image, result)
        if count != 1:
            raise ValueError(f'Se esperaba exactamente una referencia a {variable}.')
    return f'# Generado por GitHub Actions. Fuente: {revision}\n' + result

def git(*args, cwd=None):
    # No se imprimen remotos ni configuración de autenticación de Actions.
    result = subprocess.run(['git', *args], cwd=cwd, text=True, capture_output=True)
    if result.returncode:
        raise RuntimeError('La operación Git de publicación falló. Revisa los permisos de escritura de Actions y las reglas de la rama deploy/production.')
    return result.stdout.strip()

def publish(root, revision, api_image, web_image, branch=BRANCH):
    compose = render((root / 'infra/compose.portainer.yaml').read_text(), revision, api_image, web_image)
    if git('rev-parse', 'HEAD', cwd=root) != revision:
        raise ValueError('El checkout no corresponde al commit que produjo las imágenes.')
    # Una ejecución antigua nunca debe sustituir a una versión más reciente de main.
    latest = git('ls-remote', 'origin', 'refs/heads/main', cwd=root).split()
    if not latest or latest[0] != revision:
        print('Publicación omitida: main ya tiene un commit más reciente.')
        return False
    remote = git('ls-remote', 'origin', 'refs/heads/' + branch, cwd=root)
    with tempfile.TemporaryDirectory(prefix='jaguar-release-') as temporary:
        directory = Path(temporary) / 'checkout'
        if remote:
            git('fetch', '--no-tags', 'origin', 'refs/heads/' + branch, cwd=root)
            git('worktree', 'add', '--detach', str(directory), 'FETCH_HEAD', cwd=root)
        else:
            git('worktree', 'add', '--detach', str(directory), revision, cwd=root)
        try:
            if remote:
                manifest = json.loads((directory / 'release.json').read_text())
                if manifest.get('managedBy') != MARKER:
                    raise ValueError('La rama de despliegue existente no pertenece a este flujo.')
            else:
                # Rama nueva y separada: nunca se reescribe ni se hace push a main.
                git('checkout', '--orphan', 'jaguar-release-' + revision[:12], cwd=directory)
                git('rm', '-r', '-f', '--ignore-unmatch', '.', cwd=directory)
            (directory / 'infra').mkdir(exist_ok=True)
            (directory / 'infra/compose.portainer.yaml').write_text(compose)
            (directory / 'release.json').write_text(json.dumps({
                'managedBy': MARKER, 'sourceCommit': revision,
                'apiImage': api_image, 'webImage': web_image,
            }, indent=2) + '\n')
            git('add', 'infra/compose.portainer.yaml', 'release.json', cwd=directory)
            # Al reintentar un webhook fallido puede no haber cambios en el Compose.
            if git('status', '--porcelain', cwd=directory):
                git('-c', 'user.name=github-actions[bot]', '-c', 'user.email=41898282+github-actions[bot]@users.noreply.github.com',
                    'commit', '-m', 'Deploy Jaguar ' + revision, cwd=directory)
            latest = git('ls-remote', 'origin', 'refs/heads/main', cwd=root).split()
            if not latest or latest[0] != revision:
                print('Publicación omitida: main cambió durante la preparación.')
                return False
            # Push normal: si otra persona cambió la rama, Git lo rechaza. Sin force.
            git('push', 'origin', 'HEAD:refs/heads/' + branch, cwd=directory)
        finally:
            git('worktree', 'remove', '--force', str(directory), cwd=root)
    print('Compose publicado en ' + branch + ' para ' + revision + '.')
    return True

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--revision', required=True)
    parser.add_argument('--api-image', required=True)
    parser.add_argument('--web-image', required=True)
    args = parser.parse_args()
    published = publish(Path.cwd(), args.revision, args.api_image, args.web_image)
    if os.environ.get('GITHUB_OUTPUT'):
        with open(os.environ['GITHUB_OUTPUT'], 'a') as output:
            output.write('published=' + str(published).lower() + '\n')
