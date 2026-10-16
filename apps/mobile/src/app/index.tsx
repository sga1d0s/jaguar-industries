import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SecureStore from 'expo-secure-store';

type User = { id: string; name: string; email: string };
const API = process.env.EXPO_PUBLIC_API_URL || 'https://paneljaguar.sgaldos.com/api';
const KEY = 'jaguar.session';
async function request(path: string, token?: string, body?: object) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${API}${path}`, {
      method: body ? 'POST' : 'GET', signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    let data;
    try { data = await response.json(); } catch { throw new Error('El servidor no ha enviado una respuesta válida.'); }
    if (!response.ok) throw Object.assign(new Error(data.error || 'No se pudo completar la solicitud.'), { status: response.status });
    return data;
  } finally { clearTimeout(timeout); }
}
async function loadSession(): Promise<{ user: User; token: string } | null> {
  const token = await SecureStore.getItemAsync(KEY);
  if (!token) return null;
  try { const data = await request('/auth/me', token); return { user: data.user, token }; }
  catch (error: any) {
    if (error.status !== 401) throw error;
    await SecureStore.deleteItemAsync(KEY);
    return null;
  }
}
export default function App() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [busy, setBusy] = useState(true);
  const [restoring, setRestoring] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(false);
  async function restore() {
    try {
      const session = await loadSession();
      setUser(session?.user || null); setToken(session?.token || null); setRestoring(false);
    } catch { setError('No podemos recuperar la sesión. Comprueba tu conexión y vuelve a intentarlo.'); setRetry(true); }
    finally { setBusy(false); }
  }
  useEffect(() => {
    let mounted = true;
    loadSession().then(session => {
      if (mounted) { setUser(session?.user || null); setToken(session?.token || null); setRestoring(false); }
    }).catch(() => {
      if (mounted) { setError('No podemos recuperar la sesión. Comprueba tu conexión y vuelve a intentarlo.'); setRetry(true); }
    }).finally(() => { if (mounted) setBusy(false); });
    return () => { mounted = false; };
  }, []);
  async function login() {
    setBusy(true); setError('');
    try {
      const data = await request('/auth/login', undefined, { email: email.trim(), password });
      await SecureStore.setItemAsync(KEY, data.token);
      setToken(data.token); setUser(data.user); setPassword('');
    } catch (e: any) { setError(e.status ? e.message : 'No se pudo conectar. Comprueba tu conexión y vuelve a intentarlo.'); }
    finally { setBusy(false); }
  }
  async function logout() {
    setBusy(true); setError('');
    try {
      await request('/auth/logout', token!, {});
      await SecureStore.deleteItemAsync(KEY);
      setToken(null); setUser(null);
    } catch { Alert.alert('No se pudo cerrar la sesión', 'Comprueba tu conexión y vuelve a intentarlo.'); }
    finally { setBusy(false); }
  }
  return <SafeAreaView style={styles.safe}><StatusBar style="light" />
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <Text style={styles.brand}>JAGUAR</Text><Text style={styles.subtitle}>INDUSTRIAS · EQUIPOS DE ELEVACIÓN</Text>
        <View style={styles.card}>
          {restoring ? <><Text style={styles.title}>Tu espacio Jaguar</Text><Text style={styles.copy}>Recuperando tu sesión</Text>{busy && <ActivityIndicator color="#d34925" />}{retry && <Pressable style={styles.button} onPress={() => { setBusy(true); setError(''); setRetry(false); void restore(); }}><Text style={styles.buttonText}>Reintentar</Text></Pressable>}</>
          : user ? <><Text style={styles.eyebrow}>SESIÓN INICIADA</Text><Text style={styles.title}>Hola, {user.name}</Text><Text style={styles.copy}>{user.email}</Text><View style={styles.notice}><Text style={styles.noticeText}>Tu cuenta está conectada. Próximamente encontrarás aquí tus equipos y su documentación.</Text></View><Pressable disabled={busy} style={styles.button} onPress={logout}><Text style={styles.buttonText}>{busy ? 'Cerrando sesión…' : 'Cerrar sesión'}</Text></Pressable></>
          : <><Text style={styles.title}>Inicia sesión</Text><Text style={styles.copy}>Accede a tu cuenta de Jaguar.</Text>
            <Text style={styles.label}>Correo electrónico</Text><TextInput accessibilityLabel="Correo electrónico" style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" placeholder="nombre@empresa.com" placeholderTextColor="#7d858f" editable={!busy} />
            <Text style={styles.label}>Contraseña</Text><TextInput accessibilityLabel="Contraseña" style={styles.input} value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="current-password" placeholder="Tu contraseña" placeholderTextColor="#7d858f" editable={!busy} onSubmitEditing={() => { if(email.trim() && password && !busy) void login(); }} />
            <Pressable accessibilityRole="button" disabled={busy || !email.trim() || !password} style={[styles.button, (busy || !email.trim() || !password) && { opacity: 0.5 }]} onPress={login}><Text style={styles.buttonText}>{busy ? 'Conectando…' : 'Entrar'}</Text></Pressable><Text style={styles.help}>¿Necesitas acceso? Contacta con Jaguar.</Text></>}
          {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
        </View><Text style={styles.footer}>Documentación de tus equipos, siempre a mano.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#13212c' }, page: { flexGrow: 1, justifyContent: 'center', padding: 24, maxWidth: 520, width: '100%', alignSelf: 'center' },
  brand: { color: 'white', fontSize: 42, fontWeight: '900', letterSpacing: 4 }, subtitle: { color: '#a9b7c2', fontSize: 10, letterSpacing: 1.4, marginTop: 6, marginBottom: 32 },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 24 }, title: { color: '#13212c', fontSize: 28, fontWeight: '700', marginBottom: 10 }, copy: { color: '#596773', fontSize: 16, lineHeight: 24, marginBottom: 24 },
  label: { fontSize: 14, fontWeight: '600', color: '#243541', marginBottom: 8 }, input: { borderWidth: 1, borderColor: '#cdd4da', borderRadius: 10, padding: 14, fontSize: 16, marginBottom: 20, color: '#13212c', backgroundColor: '#f9fafb' },
  button: { backgroundColor: '#c34224', padding: 16, borderRadius: 10, alignItems: 'center', marginTop: 4 }, buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 }, help: { color: '#596773', textAlign: 'center', marginTop: 24, lineHeight: 21 }, error: { color: '#a52121', lineHeight: 22, marginTop: 18 }, footer: { color: '#a9b7c2', textAlign: 'center', marginTop: 28, lineHeight: 22 }, eyebrow: { color: '#a93a20', fontWeight: '700', fontSize: 12, marginBottom: 12 }, notice: { backgroundColor: '#f0f4f6', padding: 16, borderRadius: 10, marginBottom: 24 }, noticeText: { color: '#435563', lineHeight: 24 },
});
