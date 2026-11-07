import { Link } from 'react-router-dom'
import { Cloud, Shield, Share2, Zap, HardDrive, Lock, ArrowRight, Check } from 'lucide-react'

const features = [
  { icon: Cloud, title: 'Cloud Storage', desc: 'Store files securely on Amazon S3 with enterprise-grade durability and high availability.' },
  { icon: Shield, title: 'End-to-End Security', desc: 'Protected by AES-256 server-side encryption and stateless JWT authentication on every endpoint.' },
  { icon: Share2, title: 'Secure Sharing', desc: 'Generate time-limited links with custom expiration. Revoke shared access instantly whenever needed.' },
  { icon: Zap, title: 'Lightning Fast', desc: 'Direct browser-to-S3 uploads bypass Lambda bottlenecks for maximum throughput and low latency.' },
  { icon: HardDrive, title: '1 GB Free Storage', desc: 'Track your real-time storage quota and active allocations with intuitive visual analytics.' },
  { icon: Lock, title: 'Private by Default', desc: 'Complete multi-tenant isolation ensures zero access to your files by unauthorized third parties.' },
]

const highlights = ['Direct S3 uploads', 'Encrypted storage', 'Folder organization', 'Time-limited sharing', 'Trash & restore', 'Storage analytics']

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-white/80 backdrop-blur border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 rounded-xl p-2"><Cloud className="w-5 h-5 text-white" /></div>
            <span className="font-bold text-gray-900 text-xl tracking-tight">CloudVault</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors px-4 py-2">Sign in</Link>
            <Link to="/register" className="text-sm font-medium bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm">Get started</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 text-sm font-medium px-4 py-2 rounded-full mb-6">
            <Cloud className="w-4 h-4" /> Powered by Amazon S3 & AWS Lambda
          </div>
          <h1 className="text-5xl sm:text-6xl font-extrabold text-gray-900 leading-tight mb-6">
            Your files, <span className="text-indigo-600">secured</span> in the cloud
          </h1>
          <p className="text-xl text-gray-500 mb-10 max-w-2xl mx-auto leading-relaxed">
            CloudVault is an enterprise-grade cloud storage platform. Upload, organize, and share files with temporary links — backed by scalable AWS serverless architecture.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link to="/register" className="inline-flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100">
              Start for free <ArrowRight className="w-4 h-4" />
            </Link>
            <Link to="/login" className="inline-flex items-center gap-2 border border-gray-200 text-gray-700 px-6 py-3 rounded-xl font-semibold hover:bg-gray-50 transition-colors">
              Sign in
            </Link>
          </div>
          <div className="mt-8 flex items-center justify-center flex-wrap gap-4">
            {highlights.map((h) => (
              <span key={h} className="flex items-center gap-1.5 text-sm text-gray-500">
                <Check className="w-4 h-4 text-green-500" /> {h}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4 sm:px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Everything you need to manage files</h2>
            <p className="text-gray-500">Built on AWS infrastructure with security, speed, and clean design in mind.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className="bg-indigo-50 w-10 h-10 rounded-xl flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5 text-indigo-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 sm:px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Ready to experience CloudVault?</h2>
          <p className="text-gray-500 mb-8">Create your free account today and start uploading files in seconds.</p>
          <Link to="/register" className="inline-flex items-center gap-2 bg-indigo-600 text-white px-8 py-4 rounded-xl font-semibold text-lg hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100">
            Create free account <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between text-sm text-gray-400 gap-4">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 rounded-lg p-1"><Cloud className="w-3.5 h-3.5 text-white" /></div>
            <span className="font-medium text-gray-700">CloudVault</span>
          </div>
          <span>&copy; 2026 CloudVault. Academic Cloud Computing Project.</span>
        </div>
      </footer>
    </div>
  )
}
