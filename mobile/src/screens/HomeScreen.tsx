import React, { useRef, useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native'
import * as DocumentPicker from 'expo-document-picker'
import * as FileSystem from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import { WebView } from 'react-native-webview'

// pdfjs + jsPDF processor page (runs inside hidden WebView)
const PROCESSOR_HTML = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body>
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
<script>
pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

window.addEventListener('message', async (event) => {
  let data;
  try { data = JSON.parse(event.data); } catch(e) { return; }
  if (data.type !== 'PROCESS') return;

  try {
    const bytes = Uint8Array.from(atob(data.base64), c => c.charCodeAt(0));
    const pdfDoc = await pdfjsLib.getDocument({ data: bytes, password: data.password }).promise;
    const numPages = pdfDoc.numPages;

    const firstPage = await pdfDoc.getPage(1);
    const vp0 = firstPage.getViewport({ scale: 2 });
    const ptW = vp0.width / 2, ptH = vp0.height / 2;

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
      orientation: ptW > ptH ? 'landscape' : 'portrait',
      unit: 'pt',
      format: [ptW, ptH],
      compress: true,
    });

    for (let i = 1; i <= numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const vp = page.getViewport({ scale: 2 });
      const canvas = document.createElement('canvas');
      canvas.width = vp.width; canvas.height = vp.height;
      await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
      const img = canvas.toDataURL('image/jpeg', 0.92);
      const w = vp.width / 2, h = vp.height / 2;
      if (i > 1) doc.addPage([w, h]);
      doc.addImage(img, 'JPEG', 0, 0, w, h);
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'PROGRESS', pct: Math.round(i / numPages * 100) }));
    }

    const output = doc.output('datauristring');
    const b64 = output.split(',')[1];
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'DONE', b64 }));
  } catch(e) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ERROR', message: e.message || String(e) }));
  }
});
window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'READY' }));
</script>
</body>
</html>`

type Status = 'idle' | 'loading' | 'processing' | 'done' | 'error'

export default function HomeScreen() {
  const webviewRef = useRef<WebView>(null)
  const [pdfFile, setPdfFile] = useState<{ uri: string; name: string } | null>(null)
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [resultB64, setResultB64] = useState('')
  const [webviewReady, setWebviewReady] = useState(false)

  const pickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf' })
    if (result.canceled) return
    const asset = result.assets[0]
    setPdfFile({ uri: asset.uri, name: asset.name })
    setStatus('idle')
    setError('')
    setResultB64('')
  }

  const unlock = async () => {
    if (!pdfFile || !webviewReady) return
    setStatus('loading')
    setProgress(0)

    try {
      const base64 = await FileSystem.readAsStringAsync(pdfFile.uri, {
        encoding: FileSystem.EncodingType.Base64,
      })
      setStatus('processing')
      webviewRef.current?.injectJavaScript(`
        window.dispatchEvent(new MessageEvent('message', {
          data: JSON.stringify({ type: 'PROCESS', base64: ${JSON.stringify(base64)}, password: ${JSON.stringify(password)} })
        }));
        true;
      `)
    } catch {
      setStatus('error')
      setError('Could not read the file.')
    }
  }

  const handleWebViewMessage = (event: { nativeEvent: { data: string } }) => {
    const msg = JSON.parse(event.nativeEvent.data)
    if (msg.type === 'READY') {
      setWebviewReady(true)
    } else if (msg.type === 'PROGRESS') {
      setProgress(msg.pct)
    } else if (msg.type === 'DONE') {
      setResultB64(msg.b64)
      setStatus('done')
    } else if (msg.type === 'ERROR') {
      const text = (msg.message as string).toLowerCase()
      setError(text.includes('password') ? 'Incorrect password.' : 'Failed to process PDF.')
      setStatus('error')
    }
  }

  const save = async () => {
    if (!resultB64 || !pdfFile) return
    const outName = pdfFile.name.replace(/\.pdf$/i, '_unlocked.pdf')
    const outUri = FileSystem.documentDirectory + outName
    await FileSystem.writeAsStringAsync(outUri, resultB64, {
      encoding: FileSystem.EncodingType.Base64,
    })
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(outUri, { mimeType: 'application/pdf', dialogTitle: 'Save unlocked PDF' })
    } else {
      Alert.alert('Saved', `File saved to ${outUri}`)
    }
  }

  const reset = () => {
    setPdfFile(null)
    setPassword('')
    setStatus('idle')
    setProgress(0)
    setError('')
    setResultB64('')
  }

  const busy = status === 'loading' || status === 'processing'

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Hidden WebView for PDF processing */}
      <View style={styles.hidden}>
        <WebView
          ref={webviewRef}
          source={{ html: PROCESSOR_HTML }}
          onMessage={handleWebViewMessage}
          javaScriptEnabled
          originWhitelist={['*']}
        />
      </View>

      <Text style={styles.title}>MyFreePDF</Text>
      <Text style={styles.subtitle}>Remove PDF password protection</Text>

      {/* File picker */}
      <TouchableOpacity style={styles.pickBtn} onPress={pickFile} disabled={busy}>
        <Text style={styles.pickBtnText}>{pdfFile ? '📄 ' + pdfFile.name : 'Choose PDF file'}</Text>
      </TouchableOpacity>

      {pdfFile && (
        <TouchableOpacity onPress={reset}>
          <Text style={styles.removeText}>Remove file</Text>
        </TouchableOpacity>
      )}

      {/* Password */}
      <TextInput
        style={styles.input}
        placeholder="PDF password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        editable={!busy}
      />

      {/* Progress */}
      {(status === 'loading' || status === 'processing') && (
        <View style={styles.progressBox}>
          <ActivityIndicator color="#6366f1" />
          <Text style={styles.progressText}>
            {status === 'loading' ? 'Reading file…' : `Processing… ${progress}%`}
          </Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
        </View>
      )}

      {/* Error */}
      {status === 'error' && <Text style={styles.errorText}>{error}</Text>}

      {/* Result */}
      {status === 'done' && (
        <TouchableOpacity style={styles.saveBtn} onPress={save}>
          <Text style={styles.saveBtnText}>⬇ Save / Share unlocked PDF</Text>
        </TouchableOpacity>
      )}

      {/* Unlock button */}
      <TouchableOpacity
        style={[styles.unlockBtn, (!pdfFile || busy) && styles.disabled]}
        onPress={unlock}
        disabled={!pdfFile || busy}
      >
        <Text style={styles.unlockBtnText}>{busy ? 'Unlocking…' : 'Remove Password'}</Text>
      </TouchableOpacity>

      <Text style={styles.footer}>Your file never leaves your device.</Text>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, alignItems: 'center', padding: 24, paddingTop: 60, backgroundColor: '#f8fafc' },
  hidden: { width: 0, height: 0, overflow: 'hidden' },
  title: { fontSize: 28, fontWeight: '700', color: '#1e1b4b', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#6b7280', marginBottom: 32 },
  pickBtn: { width: '100%', backgroundColor: '#fff', borderWidth: 2, borderColor: '#a5b4fc', borderStyle: 'dashed', borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 8 },
  pickBtnText: { color: '#4f46e5', fontWeight: '600', fontSize: 15 },
  removeText: { color: '#a5b4fc', fontSize: 13, marginBottom: 16 },
  input: { width: '100%', backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, marginBottom: 20 },
  progressBox: { width: '100%', alignItems: 'center', gap: 8, marginBottom: 16 },
  progressText: { color: '#6366f1', fontSize: 14 },
  progressTrack: { width: '100%', height: 8, backgroundColor: '#e0e7ff', borderRadius: 99 },
  progressFill: { height: 8, backgroundColor: '#6366f1', borderRadius: 99 },
  errorText: { color: '#dc2626', backgroundColor: '#fef2f2', borderRadius: 12, padding: 12, width: '100%', textAlign: 'center', marginBottom: 16 },
  saveBtn: { width: '100%', backgroundColor: '#d1fae5', borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 16 },
  saveBtnText: { color: '#065f46', fontWeight: '700', fontSize: 16 },
  unlockBtn: { width: '100%', backgroundColor: '#6366f1', borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 16 },
  unlockBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  disabled: { opacity: 0.4 },
  footer: { fontSize: 12, color: '#9ca3af', marginTop: 8 },
})
