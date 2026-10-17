"""Prueba el despliegue con repositorios temporales y respuestas HTTP simuladas."""
import importlib.util
import json
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch, MagicMock

ROOT = Path(__file__).resolve().parents[1]

def module(name, filename):
    spec = importlib.util.spec_from_file_location(name, ROOT / 'scripts' / filename)
    loaded = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(loaded)
    return loaded

release = module('release', 'publish-release.py')
notification = module('notification', 'notify-portainer.py')
verification = module('verification', 'verify-deployment.py')
TEMPLATE = (ROOT / 'infra/compose.portainer.yaml').read_text()

def images(sha):
    return (f'ghcr.io/sga1d0s/jaguar-industries-api:sha-{sha}@sha256:' + 'b' * 64,
            f'ghcr.io/sga1d0s/jaguar-industries-web:sha-{sha}@sha256:' + 'c' * 64)

class ReleaseTests(unittest.TestCase):
    def test_render_keeps_networks_volumes_and_private_variables(self):
        sha = 'a' * 40
        api, web = images(sha)
        result = release.render(TEMPLATE, sha, api, web)
        self.assertIn('image: ' + api, result)
        self.assertIn('image: ' + web, result)
        self.assertIn('${APP_DATABASE_PASSWORD:', result)
        self.assertIn('postgres_data:/var/lib/postgresql/data', result)
        self.assertEqual(result.split('networks:\n  backend:')[1], TEMPLATE.split('networks:\n  backend:')[1])
        self.assertNotIn('${API_IMAGE', result)
        self.assertNotIn('${WEB_IMAGE', result)

    def test_rejects_mutable_images_or_mismatched_commit(self):
        sha = 'a' * 40
        api, web = images(sha)
        for invalid in ['jaguar-api:catalog-check', 'ghcr.io/sga1d0s/jaguar-industries-api:latest', images('d' * 40)[0]]:
            with self.assertRaises(ValueError):
                release.render(TEMPLATE, sha, invalid, web)
        with self.assertRaises(ValueError):
            release.render(TEMPLATE.replace('image: ${API_IMAGE:', 'image: ${REMOVED:'), sha, api, web)

    def test_publishes_separate_branch_and_skips_stale_runs(self):
        # Todo Git se ejecuta dentro del directorio temporal, sin tocar este checkout.
        with tempfile.TemporaryDirectory(prefix='jaguar-release-test-') as temporary:
            base = Path(temporary)
            remote, source = base / 'remote.git', base / 'source'
            subprocess.run(['git', 'init', '--bare', str(remote)], check=True, capture_output=True)
            subprocess.run(['git', 'init', '-b', 'main', str(source)], check=True, capture_output=True)
            def git(*args):
                return subprocess.run(['git', '-C', str(source), *args], check=True, text=True, capture_output=True).stdout.strip()
            git('config', 'user.name', 'Release Test')
            git('config', 'user.email', 'test@example.invalid')
            (source / 'infra').mkdir()
            (source / 'infra/compose.portainer.yaml').write_text(TEMPLATE)
            (source / 'source.txt').write_text('source only')
            git('add', '.')
            git('commit', '-m', 'Initial source')
            git('remote', 'add', 'origin', str(remote))
            git('push', '-u', 'origin', 'main')
            sha = git('rev-parse', 'HEAD')
            api, web = images(sha)
            self.assertTrue(release.publish(source, sha, api, web))
            self.assertEqual(git('rev-parse', 'HEAD'), sha)
            self.assertEqual(git('ls-remote', 'origin', 'refs/heads/main').split()[0], sha)
            git('fetch', 'origin', release.BRANCH)
            manifest = json.loads(git('show', 'FETCH_HEAD:release.json'))
            self.assertEqual(manifest['sourceCommit'], sha)
            self.assertEqual(git('ls-tree', '-r', '--name-only', 'FETCH_HEAD').splitlines(), ['infra/compose.portainer.yaml', 'release.json'])
            self.assertTrue(release.publish(source, sha, api, web))
            # Un cambio posterior de main deja la rama de producción anterior intacta.
            deployed = git('ls-remote', 'origin', 'refs/heads/' + release.BRANCH).split()[0]
            (source / 'source.txt').write_text('newer source')
            git('commit', '-am', 'New source')
            git('push', 'origin', 'main')
            git('checkout', '--detach', sha)
            self.assertFalse(release.publish(source, sha, api, web))
            self.assertEqual(git('ls-remote', 'origin', 'refs/heads/' + release.BRANCH).split()[0], deployed)

    def test_webhook_acceptance_is_not_deployment_verification(self):
        response = MagicMock()
        response.__enter__.return_value.status = 204
        with patch.object(notification.urllib.request, 'build_opener') as opener:
            opener.return_value.open.return_value = response
            notification.notify('https://portainer.example.test/api/stacks/webhooks/test-only')
        for status in [200, 202]:
            response.__enter__.return_value.status = status
            with patch.object(notification.urllib.request, 'build_opener') as opener:
                opener.return_value.open.return_value = response
                with self.assertRaises(ValueError):
                    notification.notify('https://portainer.example.test/api/stacks/webhooks/test-only')

    def test_verify_requires_both_revisions_and_database(self):
        sha = 'a' * 40
        def run(values):
            responses = []
            for value in values:
                response = MagicMock()
                response.__enter__.return_value.read.return_value = json.dumps(value).encode()
                responses.append(response)
            return responses
        with patch.object(verification.urllib.request, 'urlopen', side_effect=run([{'revision': sha}, {'revision': sha}, {'status': 'ok'}])):
            verification.verify('https://panel.example.test', sha)
        # La API antigua o PostgreSQL no disponible deben hacer fallar la comprobación.
        for values in [[{'revision': 'old'}, {'revision': sha}, {'status': 'ok'}], [{'revision': sha}, {'revision': sha}, {'status': 'down'}]]:
            with patch.object(verification.urllib.request, 'urlopen', side_effect=run(values)), patch.object(verification.time, 'monotonic', side_effect=[0, 0, 999]), patch.object(verification.time, 'sleep'):
                with self.assertRaises(ValueError):
                    verification.verify('https://panel.example.test', sha)

if __name__ == '__main__':
    unittest.main()
