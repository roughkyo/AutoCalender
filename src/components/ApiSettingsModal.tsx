import React from 'react';
import { Key, CheckCircle2, AlertCircle, X, Shield, Cpu, ExternalLink } from 'lucide-react';

interface ApiSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ApiSettingsModal: React.FC<ApiSettingsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden border border-gray-100 animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center space-x-2 text-gray-900 font-semibold">
            <Key className="w-5 h-5 text-indigo-600" />
            <span>API 키 및 연동 설정</span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Gemini AI Status */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Cpu className="w-4 h-4 text-indigo-500" />
                Gemini AI 모델
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5" />
                gemini-3.1-flash-lite 활성화됨
              </span>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              학사력 텍스트 추출 및 정밀 파싱에 최적화된 Gemini Flash Lite 모델이 서버 측에서 안전하게 호출됩니다.
            </p>
          </div>

          <hr className="border-gray-100" />

          {/* API Key management info */}
          <div className="bg-indigo-50/60 rounded-xl p-4 border border-indigo-100 space-y-2">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-xs font-semibold text-indigo-900">API 키 관리 안내</h4>
                <p className="text-xs text-indigo-700 leading-relaxed">
                  Gemini API Key는 AI Studio 설정(Settings &gt; Secrets) 메뉴에서 관리 및 수정할 수 있습니다. 보안을 위해 서버 측에서 안전하게 프록시됩니다.
                </p>
              </div>
            </div>
          </div>

          {/* Google Calendar API Status */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">구글 캘린더 연동</span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                <CheckCircle2 className="w-3.5 h-3.5" />
                API 준비됨
              </span>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              사용자 구글 계정 인증(OAuth)을 통해 '학교' 캘린더를 생성하고 일정을 자동으로 등록합니다.
            </p>
          </div>
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors shadow-xs"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
};
