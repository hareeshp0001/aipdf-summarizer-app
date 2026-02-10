import { useState, useEffect, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Toaster, toast } from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import {
  Upload, FileText, Sparkles, Clock, Trash2, X, Copy,
  Check, ChevronRight, Brain, Zap, BarChart3, Plus,
  FileSearch, Download, RefreshCw
} from 'lucide-react'
import './App.css'

const API_URL = '/api'

function App() {
  const [view, setView] = useState('upload') // upload | processing | result | history
  const [file, setFile] = useState(null)
  const [summaryLength, setSummaryLength] = useState('medium')
  const [result, setResult] = useState(null)
  const [history, setHistory] = useState([])
  const [processingStep, setProcessingStep] = useState(0)
  const [copied, setCopied] = useState(false)
  const [modalItem, setModalItem] = useState(null)
  const [loadingHistory, setLoadingHistory] = useState(false)

  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true)
    try {
      const res = await fetch(`${API_URL}/summaries`)
      if (res.ok) {
        const data = await res.json()
        setHistory(data)
      }
    } catch {
      // silent
    } finally {
      setLoadingHistory(false)
    }
  }, [])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0])
      setResult(null)
      setView('upload')
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    maxSize: 20 * 1024 * 1024,
    onDropRejected: (rejections) => {
      const err = rejections[0]?.errors[0]
      if (err?.code === 'file-too-large') toast.error('File too large. Max 20MB.')
      else if (err?.code === 'file-invalid-type') toast.error('Only PDF files accepted.')
      else toast.error('Invalid file.')
    },
  })

  const handleSummarize = async () => {
    if (!file) return

    setView('processing')
    setProcessingStep(0)

    const formData = new FormData()
    formData.append('pdf', file)
    formData.append('length', summaryLength)

    const stepTimers = [
      setTimeout(() => setProcessingStep(1), 1200),
      setTimeout(() => setProcessingStep(2), 3000),
    ]

    try {
      const res = await fetch(`${API_URL}/summarize`, {
        method: 'POST',
        body: formData,
      })

      stepTimers.forEach(clearTimeout)

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Summarization failed')
      }

      const data = await res.json()
      setProcessingStep(3)
      
      setTimeout(() => {
        setResult(data)
        setView('result')
        setFile(null)
        fetchHistory()
        toast.success('Summary generated successfully!')
      }, 600)
    } catch (err) {
      stepTimers.forEach(clearTimeout)
      setView('upload')
      toast.error(err.message || 'Failed to summarize PDF')
    }
  }

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    toast.success('Copied to clipboard!')
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDelete = async (id, e) => {
    e?.stopPropagation()
    try {
      await fetch(`${API_URL}/summaries/${id}`, { method: 'DELETE' })
      setHistory((prev) => prev.filter((item) => item.id !== id))
      if (modalItem?.id === id) setModalItem(null)
      toast.success('Summary deleted')
    } catch {
      toast.error('Failed to delete')
    }
  }

  const handleDownload = (summary, filename) => {
    const blob = new Blob([summary], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${filename?.replace('.pdf', '') || 'summary'}-summary.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B'
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / 1048576).toFixed(1) + ' MB'
  }

  const formatDate = (dateStr) => {
    const d = new Date(dateStr)
    const now = new Date()
    const diff = now - d
    if (diff < 60000) return 'Just now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const resetToUpload = () => {
    setView('upload')
    setFile(null)
    setResult(null)
  }

  return (
    <>
      <div className="bg-grid" />
      <div className="bg-glow" />
      <div className="bg-glow-2" />

      <div className="app">
        {/* Header */}
        <header className="header">
          <div className="logo" onClick={resetToUpload} style={{ cursor: 'pointer' }}>
            <div className="logo-icon">
              <Brain size={22} color="white" />
            </div>
            <div className="logo-text">
              Summarize<span>AI</span>
            </div>
          </div>
          <nav className="header-nav">
            <button
              className={`nav-btn ${view === 'upload' || view === 'processing' || view === 'result' ? 'active' : ''}`}
              onClick={resetToUpload}
            >
              <Sparkles size={14} /> Summarize
            </button>
            <button
              className={`nav-btn ${view === 'history' ? 'active' : ''}`}
              onClick={() => { setView('history'); fetchHistory() }}
            >
              <Clock size={14} /> History
              {history.length > 0 && <span className="section-count">{history.length}</span>}
            </button>
          </nav>
        </header>

        {/* Main */}
        <main className="main">
          <AnimatePresence mode="wait">
            {/* Upload View */}
            {view === 'upload' && (
              <motion.div
                key="upload"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                {/* Hero */}
                <div className="hero">
                  <div className="hero-badge">
                    <div className="hero-badge-dot" />
                    AI-Powered Summarization
                  </div>
                  <h1>
                    Transform PDFs into<br />
                    <span className="gradient-text">Instant Insights</span>
                  </h1>
                  <p>
                    Upload any PDF document and get a concise, AI-generated summary in seconds.
                    Powered by advanced language models for human-like understanding.
                  </p>
                </div>

                {/* Upload Zone or File Selected */}
                {!file ? (
                  <div className="upload-zone-wrapper">
                    <div
                      {...getRootProps()}
                      className={`upload-zone ${isDragActive ? 'drag-active' : ''}`}
                    >
                      <input {...getInputProps()} />
                      <div className="upload-icon-wrapper">
                        <Upload size={32} color="var(--accent-light)" />
                      </div>
                      <h3>{isDragActive ? 'Drop your PDF here' : 'Drop your PDF here or click to browse'}</h3>
                      <p>Supports PDF files up to 20MB</p>
                      <div className="upload-hint">
                        <FileSearch size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                        Text-based PDFs work best for accurate summaries
                      </div>
                    </div>

                    {/* Length Selector */}
                    <div className="length-selector">
                      {[
                        { key: 'short', label: 'Brief', icon: <Zap size={14} /> },
                        { key: 'medium', label: 'Standard', icon: <FileText size={14} /> },
                        { key: 'long', label: 'Detailed', icon: <BarChart3 size={14} /> },
                      ].map((opt) => (
                        <button
                          key={opt.key}
                          className={`length-btn ${summaryLength === opt.key ? 'active' : ''}`}
                          onClick={() => setSummaryLength(opt.key)}
                        >
                          {opt.icon} {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="file-selected fade-in-up">
                    <div className="file-info">
                      <div className="file-icon">
                        <FileText size={28} color="#ff6b6b" />
                      </div>
                      <div className="file-details">
                        <div className="file-name">{file.name}</div>
                        <div className="file-meta">
                          <span>{formatFileSize(file.size)}</span>
                          <span>PDF Document</span>
                        </div>
                      </div>
                      <div className="file-actions">
                        <button className="btn-remove" onClick={() => setFile(null)}>
                          <X size={16} />
                        </button>
                      </div>
                    </div>

                    {/* Length Selector */}
                    <div className="length-selector" style={{ justifyContent: 'flex-start', marginTop: 16, marginBottom: 20 }}>
                      {[
                        { key: 'short', label: 'Brief' },
                        { key: 'medium', label: 'Standard' },
                        { key: 'long', label: 'Detailed' },
                      ].map((opt) => (
                        <button
                          key={opt.key}
                          className={`length-btn ${summaryLength === opt.key ? 'active' : ''}`}
                          onClick={() => setSummaryLength(opt.key)}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>

                    <button className="btn-summarize" onClick={handleSummarize}>
                      <Sparkles size={18} />
                      Generate Summary
                      <ChevronRight size={18} />
                    </button>
                  </div>
                )}

                {/* Features */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: 16,
                  marginTop: 48
                }}>
                  {[
                    { icon: <Zap size={20} />, title: 'Lightning Fast', desc: 'Get summaries in seconds, not hours' },
                    { icon: <Brain size={20} />, title: 'AI-Powered', desc: 'Advanced LLM for human-like understanding' },
                    { icon: <BarChart3 size={20} />, title: 'Flexible Length', desc: 'Choose brief, standard, or detailed' },
                    { icon: <Clock size={20} />, title: 'Save History', desc: 'Access your past summaries anytime' },
                  ].map((f, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 * i }}
                      style={{
                        padding: 24,
                        borderRadius: 'var(--radius-lg)',
                        border: '1px solid var(--border)',
                        background: 'var(--bg-card)',
                      }}
                    >
                      <div style={{
                        width: 40,
                        height: 40,
                        borderRadius: 'var(--radius-sm)',
                        background: 'rgba(108, 92, 231, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--accent-light)',
                        marginBottom: 12,
                      }}>
                        {f.icon}
                      </div>
                      <h4 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{f.title}</h4>
                      <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{f.desc}</p>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Processing View */}
            {view === 'processing' && (
              <motion.div
                key="processing"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
                className="processing"
              >
                <div className="processing-animation">
                  <div className="processing-ring" />
                  <div className="processing-ring" />
                  <div className="processing-ring" />
                  <div className="processing-icon">
                    <Brain size={28} color="var(--accent-light)" />
                  </div>
                </div>
                <h3 className="shimmer-text">Analyzing Your Document</h3>
                <p>Our AI is reading and understanding your PDF...</p>

                <div className="processing-steps">
                  {[
                    'Extracting text',
                    'Analyzing content',
                    'Generating summary',
                  ].map((step, i) => (
                    <div
                      key={i}
                      className={`processing-step ${processingStep === i ? 'active' : ''} ${processingStep > i ? 'done' : ''}`}
                    >
                      <div className="step-dot" />
                      {processingStep > i ? <Check size={14} /> : null}
                      {step}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Result View */}
            {view === 'result' && result && (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4 }}
              >
                <div className="result-card">
                  <div className="result-header">
                    <div className="result-header-left">
                      <div className="result-success-icon">
                        <Check size={22} color="var(--success)" />
                      </div>
                      <div>
                        <div className="result-title">{result.filename}</div>
                        <div className="result-subtitle">
                          Summary generated {formatDate(result.createdAt)}
                        </div>
                      </div>
                    </div>
                    <div className="result-actions">
                      <button className="btn-action" onClick={() => handleCopy(result.summary)}>
                        {copied ? <Check size={14} /> : <Copy size={14} />}
                        {copied ? 'Copied' : 'Copy'}
                      </button>
                      <button className="btn-action" onClick={() => handleDownload(result.summary, result.filename)}>
                        <Download size={14} /> Export
                      </button>
                    </div>
                  </div>

                  <div className="result-stats">
                    <div className="stat-item">
                      <div className="stat-value">{result.pageCount || '-'}</div>
                      <div className="stat-label">Pages</div>
                    </div>
                    <div className="stat-item">
                      <div className="stat-value">{result.textLength ? (result.textLength / 1000).toFixed(1) + 'k' : '-'}</div>
                      <div className="stat-label">Characters</div>
                    </div>
                    <div className="stat-item">
                      <div className="stat-value">{result.summary ? result.summary.split(/\s+/).length : '-'}</div>
                      <div className="stat-label">Summary Words</div>
                    </div>
                    <div className="stat-item">
                      <div className="stat-value" style={{ textTransform: 'capitalize' }}>{result.summaryLength || '-'}</div>
                      <div className="stat-label">Length Mode</div>
                    </div>
                  </div>

                  <div className="result-body">
                    <div className="markdown-content">
                      <ReactMarkdown>{result.summary}</ReactMarkdown>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
                  <button className="btn-new" onClick={resetToUpload}>
                    <Plus size={16} /> Summarize Another
                  </button>
                </div>
              </motion.div>
            )}

            {/* History View */}
            {view === 'history' && (
              <motion.div
                key="history"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <div className="history-section">
                  <div className="section-header">
                    <div className="section-title">
                      <Clock size={24} /> Summary History
                      {history.length > 0 && (
                        <span className="section-count">{history.length}</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn-action" onClick={fetchHistory} disabled={loadingHistory}>
                        <RefreshCw size={14} className={loadingHistory ? 'spinning' : ''} /> Refresh
                      </button>
                      <button className="btn-new" onClick={resetToUpload}>
                        <Plus size={16} /> New Summary
                      </button>
                    </div>
                  </div>

                  {history.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-state-icon">
                        <FileText size={32} color="var(--text-muted)" />
                      </div>
                      <h3>No summaries yet</h3>
                      <p>Upload a PDF to create your first AI summary</p>
                    </div>
                  ) : (
                    <div className="history-grid">
                      {history.map((item, i) => (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.05 * i }}
                          className="history-card"
                          onClick={() => setModalItem(item)}
                        >
                          <div className="history-card-header">
                            <div className="history-card-title">
                              {item.original_filename}
                            </div>
                            <div className="history-card-date">
                              {formatDate(item.created_at)}
                            </div>
                          </div>
                          <div className="history-card-preview">
                            {item.summary}
                          </div>
                          <div className="history-card-footer">
                            <div className="history-card-meta">
                              <span className="meta-tag">{item.page_count || '?'} pages</span>
                              <span className="meta-tag">{formatFileSize(item.file_size)}</span>
                              <span className="meta-tag" style={{ textTransform: 'capitalize' }}>{item.summary_length}</span>
                            </div>
                            <button
                              className="btn-delete-small"
                              onClick={(e) => handleDelete(item.id, e)}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {modalItem && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setModalItem(null)}
          >
            <motion.div
              className="modal-content"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <h3>{modalItem.original_filename}</h3>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn-action" onClick={() => handleCopy(modalItem.summary)}>
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                  <button className="btn-action" onClick={() => handleDownload(modalItem.summary, modalItem.original_filename)}>
                    <Download size={14} /> Export
                  </button>
                  <button className="btn-close" onClick={() => setModalItem(null)}>
                    <X size={16} />
                  </button>
                </div>
              </div>
              <div className="modal-body">
                <div style={{
                  display: 'flex',
                  gap: 12,
                  marginBottom: 20,
                  flexWrap: 'wrap',
                }}>
                  <span className="meta-tag">{modalItem.page_count || '?'} pages</span>
                  <span className="meta-tag">{formatFileSize(modalItem.file_size)}</span>
                  <span className="meta-tag" style={{ textTransform: 'capitalize' }}>{modalItem.summary_length}</span>
                  <span className="meta-tag">{formatDate(modalItem.created_at)}</span>
                </div>
                <div className="markdown-content">
                  <ReactMarkdown>{modalItem.summary}</ReactMarkdown>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Toaster
        position="bottom-right"
        toastOptions={{
          className: 'toast-custom',
          duration: 3000,
        }}
      />
    </>
  )
}

export default App
