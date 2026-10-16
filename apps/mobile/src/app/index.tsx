import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Redirect } from 'expo-router';
import { useAuth } from '../lib/session';
import { errorMessage } from '../lib/api';

// El login conserva solo los campos del formulario. La sesión vive en AuthProvider.
export default function App() {
  const auth=useAuth();
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  async function login() {
    setBusy(true);setError('');
    try {await auth.login(email,password);setPassword('');}
    catch(error){setError(errorMessage(error));}
    finally{setBusy(false);}
  }
  async function restoreSession() {
    setBusy(true);setError('');
    try{await auth.restore();}catch{setError('Comprueba tu conexión y vuelve a intentarlo.');}
    finally{setBusy(false);}
  }
  // Tras el login o la restauración, sustituye la ruta para que Atrás no vuelva al formulario.
  if(auth.ready && auth.user)return <Redirect href="/equipos" />;
  return <SafeAreaView style={styles.safe}><StatusBar style="light" />
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <Text style={styles.brand}>JAGUAR</Text><Text style={styles.subtitle}>INDUSTRIAS · EQUIPOS DE ELEVACIÓN</Text>
        <View style={styles.card}>
          {!auth.ready ? <><Text style={styles.title}>Tu espacio Jaguar</Text><Text style={styles.copy}>Recuperando tu sesión</Text>{(busy || !auth.restoreError) && <ActivityIndicator color="#d34925" />}{auth.restoreError && <Pressable style={styles.button} onPress={restoreSession}><Text style={styles.buttonText}>Reintentar</Text></Pressable>}</>
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
// Presentación compartida por Android e iOS: colores, espaciado y estados visuales.
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#13212c' }, page: { flexGrow: 1, justifyContent: 'center', padding: 24, maxWidth: 520, width: '100%', alignSelf: 'center' },
  brand: { color: 'white', fontSize: 42, fontWeight: '900', letterSpacing: 4 }, subtitle: { color: '#a9b7c2', fontSize: 10, letterSpacing: 1.4, marginTop: 6, marginBottom: 32 },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 24 }, title: { color: '#13212c', fontSize: 28, fontWeight: '700', marginBottom: 10 }, copy: { color: '#596773', fontSize: 16, lineHeight: 24, marginBottom: 24 },
  label: { fontSize: 14, fontWeight: '600', color: '#243541', marginBottom: 8 }, input: { borderWidth: 1, borderColor: '#cdd4da', borderRadius: 10, padding: 14, fontSize: 16, marginBottom: 20, color: '#13212c', backgroundColor: '#f9fafb' },
  button: { backgroundColor: '#c34224', padding: 16, borderRadius: 10, alignItems: 'center', marginTop: 4 }, buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 }, help: { color: '#596773', textAlign: 'center', marginTop: 24, lineHeight: 21 }, error: { color: '#a52121', lineHeight: 22, marginTop: 18 }, footer: { color: '#a9b7c2', textAlign: 'center', marginTop: 28, lineHeight: 22 }, eyebrow: { color: '#a93a20', fontWeight: '700', fontSize: 12, marginBottom: 12 }, notice: { backgroundColor: '#f0f4f6', padding: 16, borderRadius: 10, marginBottom: 24 }, noticeText: { color: '#435563', lineHeight: 24 },
});
