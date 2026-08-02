import React, { useState, useEffect } from 'react';
import { 
  Calendar as CalendarIcon, 
  Upload, 
  FileText, 
  CheckCircle2, 
  Loader2, 
  Settings, 
  Sparkles, 
  Plus, 
  Trash2, 
  Edit3, 
  LogOut, 
  ArrowRight, 
  AlertCircle,
  ExternalLink,
  Check,
  RefreshCcw,
  CalendarDays,
  Key,
  Cpu,
  Shield,
  Clock,
  BookOpen
} from 'lucide-react';
import { CalendarEvent, Step } from './types';
import { initAuth, googleSignIn, getAccessToken, logout } from './lib/googleAuth';
import { ApiSettingsModal } from './components/ApiSettingsModal';
import { User } from 'firebase/auth';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const [step, setStep] = useState<Step>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<CalendarEvent | null>(null);

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 });
  const [syncResult, setSyncResult] = useState<{ success: boolean; count: number; calendarName: string } | null>(null);

  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, accessToken) => {
        setUser(currentUser);
        setToken(accessToken);
      },
      () => {
        setUser(null);
        setToken(null);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const res = await googleSignIn();
      if (res) {
        setUser(res.user);
        setToken(res.accessToken);
      }
    } catch (err: any) {
      console.error('Login failed:', err);
      alert('구글 로그인에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
    setToken(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setParseError(null);
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          setFilePreview(event.target?.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        setFilePreview(null);
      }
    }
  };

  const handleParseCalendar = async () => {
    if (!selectedFile) return;

    setIsParsing(true);
    setParseError(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const res = await fetch('/api/parse-calendar', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '학사력 파싱 중 오류가 발생했습니다.');
      }

      setEvents(data.events || []);
      setStep('review');
    } catch (err: any) {
      console.error('Parse error:', err);
      setParseError(err.message || '학사력 분석에 실패했습니다.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleAddEvent = () => {
    const newEvent: CalendarEvent = {
      title: '새 일정',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
      category: '행사',
      description: '',
    };
    setEvents([newEvent, ...events]);
    setEditingIndex(0);
    setEditForm(newEvent);
  };

  const handleDeleteEvent = (index: number) => {
    setEvents(events.filter((_, i) => i !== index));
    if (editingIndex === index) {
      setEditingIndex(null);
      setEditForm(null);
    }
  };

  const handleStartEdit = (index: number) => {
    setEditingIndex(index);
    setEditForm({ ...events[index] });
  };

  const handleSaveEdit = (index: number) => {
    if (!editForm) return;
    const updated = [...events];
    updated[index] = editForm;
    setEvents(updated);
    setEditingIndex(null);
    setEditForm(null);
  };

  const handleSyncToGoogleCalendar = async () => {
    if (!token) {
      alert('구글 캘린더 연동을 위해 먼저 로그인을 해주세요.');
      return;
    }

    if (events.length === 0) {
      alert('등록할 일정이 없습니다.');
      return;
    }

    setIsSyncing(true);
    setSyncProgress({ current: 0, total: events.length });

    try {
      const listRes = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const listData = await listRes.json();
      
      let schoolCalendar = listData.items?.find((cal: any) => cal.summary === '학교');
      let calendarId = schoolCalendar?.id;

      if (!calendarId) {
        const createRes = await fetch('https://www.googleapis.com/calendar/v3/calendars', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            summary: '학교',
            description: 'AI 학사력 동기화 서비스로 생성된 학교 일정 캘린더',
            timeZone: 'Asia/Seoul',
          }),
        });
        const createData = await createRes.json();
        if (!createRes.ok) {
          throw new Error(createData.error?.message || '구글 캘린더 생성을 실패했습니다.');
        }
        calendarId = createData.id;
      }

      let successCount = 0;
      for (let i = 0; i < events.length; i++) {
        const ev = events[i];
        const startDate = ev.startDate;
        let endDate = ev.endDate || ev.startDate;
        
        const endDateTimeObj = new Date(endDate);
        endDateTimeObj.setDate(endDateTimeObj.getDate() + 1);
        const exclusiveEndDate = endDateTimeObj.toISOString().split('T')[0];

        const eventBody = {
          summary: `[${ev.category}] ${ev.title}`,
          description: ev.description || '',
          start: { date: startDate },
          end: { date: exclusiveEndDate },
        };

        try {
          const insertRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(eventBody),
          });
          if (insertRes.ok) {
            successCount++;
          }
        } catch (e) {
          console.error(`Failed to insert event: ${ev.title}`, e);
        }

        setSyncProgress({ current: i + 1, total: events.length });
      }

      setSyncResult({ success: true, count: successCount, calendarName: '학교' });
      setStep('complete');
    } catch (err: any) {
      console.error('Sync error:', err);
      alert(err.message || '구글 캘린더 동기화 중 오류가 발생했습니다.');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="bg-slate-50 text-slate-900 h-screen w-screen flex flex-row overflow-hidden font-sans border border-slate-200">
      {/* 왼쪽 사이드바: API 및 설정 */}
      <aside className="w-72 bg-white border-r border-slate-200 p-6 flex flex-col gap-8 shrink-0 overflow-y-auto">
        <div>
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-sm">A</div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">학사력 동기화</h1>
            </div>
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-50 transition-colors"
              title="API 설정"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
          
          <section className="space-y-4">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">API 설정 및 상태</h2>
            <div className="space-y-3">
              <div className="group">
                <label className="block text-xs font-medium text-slate-600 mb-1">Gemini API 키</label>
                <div className="relative">
                  <input
                    type="password"
                    disabled
                    value="••••••••••••••••"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm text-slate-500 focus:outline-none"
                  />
                  <div className="absolute right-2.5 top-2 text-[10px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                    사용 중
                  </div>
                </div>
              </div>
              <div className="group">
                <label className="block text-xs font-medium text-slate-600 mb-1">AI 모델 선택</label>
                <div className="w-full px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-md text-xs text-indigo-700 font-mono flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">gemini-3.5-flash-lite</span>
                </div>
              </div>
            </div>
          </section>

          {/* 구글 계정 인증 상태 */}
          <div className="mt-6 pt-6 border-t border-slate-100">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">구글 계정</h2>
            {user ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-2 bg-slate-50 rounded-xl border border-slate-200">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="Avatar" className="w-8 h-8 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-xs shrink-0">
                      {user.email?.[0]?.toUpperCase() || 'U'}
                    </div>
                  )}
                  <div className="overflow-hidden">
                    <p className="text-xs font-semibold text-slate-900 truncate">{user.displayName || '사용자'}</p>
                    <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>로그아웃</span>
                </button>
              </div>
            ) : (
              <button
                onClick={handleLogin}
                disabled={isLoggingIn}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-all shadow-sm"
              >
                {isLoggingIn ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarIcon className="w-4 h-4" />}
                <span>구글 캘린더 연동 로그인</span>
              </button>
            )}
          </div>
        </div>

        <nav className="mt-auto space-y-1">
          <button 
            onClick={() => { if (events.length > 0) setStep('review'); else setStep('upload'); }}
            className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors text-left ${step !== 'complete' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <CalendarDays className="w-4 h-4" />
            <span>캘린더 동기화</span>
          </button>
          <button onClick={() => setIsSettingsOpen(true)} className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50 rounded-md transition-colors text-left">
            <Key className="w-4 h-4" />
            <span>API 설정</span>
          </button>
          <a href="https://calendar.google.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50 rounded-md transition-colors">
            <ExternalLink className="w-4 h-4" />
            <span>구글 캘린더 열기</span>
          </a>
        </nav>
      </aside>

      {/* 메인 콘텐츠 영역 */}
      <main className="flex-1 flex flex-col p-8 lg:p-10 overflow-y-auto">
        <header className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 pb-6 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 rounded-full text-xs font-semibold uppercase tracking-wider">
                {step === 'upload' && '1단계: 파일 업로드'}
                {step === 'review' && '2단계: 일정 검토 및 수정'}
                {step === 'syncing' && '3단계: 동기화 진행 중'}
                {step === 'complete' && '3단계: 완료'}
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              {step === 'upload' && '학사력 캘린더 통합 동기화'}
              {step === 'review' && '추출된 학사 일정 검토'}
              {step === 'syncing' && '구글 캘린더 동기화 중'}
              {step === 'complete' && '구글 캘린더 등록 완료'}
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              {step === 'upload' && "Gemini AI를 활용해 학사력 파일에서 일정을 정밀 추출하고 '학교' 캘린더에 간편하게 등록하세요."}
              {step === 'review' && "추출된 날짜와 제목을 확인하고, 필요시 일정을 수정하거나 추가한 뒤 동기화하세요."}
              {step === 'syncing' && "'학교' 캘린더를 생성하고 일정을 안전하게 등록하고 있습니다..."}
              {step === 'complete' && "모든 학사 일정이 구글 캘린더에 성공적으로 등록되었습니다."}
            </p>
          </div>
          <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-xs">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-xs font-medium text-slate-600">
              {user ? `작업 공간: ${user.email}` : '작업 공간: 로그인 필요'}
            </span>
          </div>
        </header>

        {/* 단계별 뷰 */}
        <div className="flex-1 flex flex-col">
          {/* 1단계: 업로드 뷰 */}
          {step === 'upload' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch flex-1">
              {/* 업로드 드롭존 카드 */}
              <div className="bg-white border border-slate-200 rounded-2xl p-8 flex flex-col items-center justify-center text-center border-dashed border-2 hover:border-indigo-400 transition-colors cursor-pointer group relative">
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={handleFileChange}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-indigo-50 group-hover:scale-105 transition-all shadow-xs">
                  <Upload className="w-8 h-8 text-slate-400 group-hover:text-indigo-600 transition-colors" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900">학사력 파일 업로드</h3>
                <p className="text-sm text-slate-500 mt-2 px-6">
                  PDF 또는 이미지 학사력 파일을 여기에 드래그하거나 클릭하여 업로드하세요.
                </p>

                {selectedFile && (
                  <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-700 text-sm font-medium z-10">
                    <FileText className="w-4 h-4" />
                    <span>{selectedFile.name}</span>
                    <span className="text-xs text-indigo-400">({(selectedFile.size / 1024 / 1024).toFixed(1)} MB)</span>
                  </div>
                )}
              </div>

              {/* 우측 안내 및 실행 패널 */}
              <div className="flex flex-col justify-between bg-white border border-slate-200 rounded-2xl p-8 shadow-xs">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <h3 className="text-base font-bold text-slate-900">서비스 이용 안내</h3>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Gemini 3.5 Flash Lite 멀티모달 AI를 활용하여 학교 학사력 문서에서 일정을 누락 없이 정확하게 읽어와 구글 캘린더에 자동으로 매핑합니다.
                    </p>
                  </div>

                  <div className="space-y-3 pt-2">
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">1</div>
                      <p className="text-xs text-slate-600 leading-relaxed">학교 공식 학사력 PDF 또는 이미지 파일을 업로드합니다.</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">2</div>
                      <p className="text-xs text-slate-600 leading-relaxed">분류별(시험, 행사, 휴일 등)로 추출된 일정을 검토합니다.</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">3</div>
                      <p className="text-xs text-slate-600 leading-relaxed">버튼 한 번으로 구글 캘린더에 '학교' 캘린더를 생성하고 등록합니다.</p>
                    </div>
                  </div>

                  {parseError && (
                    <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-center gap-3 text-rose-700 text-xs">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{parseError}</span>
                    </div>
                  )}
                </div>

                <div className="pt-6 mt-6 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs text-slate-400">
                    {selectedFile ? '파일 준비됨' : '선택된 파일 없음'}
                  </span>
                  <button
                    onClick={handleParseCalendar}
                    disabled={!selectedFile || isParsing}
                    className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold rounded-xl text-sm transition-all shadow-sm flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                  >
                    {isParsing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>일정 추출 중...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>Gemini AI로 일정 추출하기</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 2단계: 일정 검토 뷰 */}
          {step === 'review' && (
            <div className="space-y-6 flex-1 flex flex-col">
              <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-sm">
                    {events.length}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">추출된 일정 준비 완료</h3>
                    <p className="text-xs text-slate-500">구글 캘린더 동기화 전 일정을 검토하고 수정하거나 추가하세요.</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleAddEvent}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>일정 추가</span>
                  </button>
                  <button
                    onClick={() => setStep('upload')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
                  >
                    <RefreshCcw className="w-4 h-4" />
                    <span>다른 파일 업로드</span>
                  </button>
                </div>
              </div>

              {/* 일정 테이블 */}
              <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden flex-1 flex flex-col">
                <div className="overflow-x-auto flex-1">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs font-semibold uppercase tracking-wider">
                        <th className="py-3 px-4">분류</th>
                        <th className="py-3 px-4">제목</th>
                        <th className="py-3 px-4">시작일</th>
                        <th className="py-3 px-4">종료일</th>
                        <th className="py-3 px-4">상세 설명</th>
                        <th className="py-3 px-4 text-right">관리</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {events.map((ev, index) => {
                        const isEditing = editingIndex === index;
                        return (
                          <tr key={index} className="hover:bg-slate-50/60 transition-colors">
                            <td className="py-3 px-4 whitespace-nowrap">
                              {isEditing ? (
                                <select
                                  value={editForm?.category || '행사'}
                                  onChange={(e) => setEditForm({ ...editForm!, category: e.target.value })}
                                  className="text-xs px-2 py-1 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                  <option value="행사">행사</option>
                                  <option value="시험">시험</option>
                                  <option value="방학/휴일">방학/휴일</option>
                                  <option value="기타">기타</option>
                                </select>
                              ) : (
                                <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
                                  ev.category === '시험' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                                  ev.category === '방학/휴일' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                                  'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                }`}>
                                  {ev.category}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 font-medium text-slate-900">
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={editForm?.title || ''}
                                  onChange={(e) => setEditForm({ ...editForm!, title: e.target.value })}
                                  className="w-full text-sm px-2 py-1 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                              ) : (
                                ev.title
                              )}
                            </td>
                            <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                              {isEditing ? (
                                <input
                                  type="date"
                                  value={editForm?.startDate || ''}
                                  onChange={(e) => setEditForm({ ...editForm!, startDate: e.target.value })}
                                  className="text-xs px-2 py-1 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                              ) : (
                                ev.startDate
                              )}
                            </td>
                            <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                              {isEditing ? (
                                <input
                                  type="date"
                                  value={editForm?.endDate || ''}
                                  onChange={(e) => setEditForm({ ...editForm!, endDate: e.target.value })}
                                  className="text-xs px-2 py-1 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                              ) : (
                                ev.endDate
                              )}
                            </td>
                            <td className="py-3 px-4 text-slate-500 truncate max-w-xs">
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={editForm?.description || ''}
                                  onChange={(e) => setEditForm({ ...editForm!, description: e.target.value })}
                                  className="w-full text-sm px-2 py-1 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                              ) : (
                                ev.description || '-'
                              )}
                            </td>
                            <td className="py-3 px-4 text-right whitespace-nowrap">
                              {isEditing ? (
                                <div className="flex items-center justify-end space-x-2">
                                  <button
                                    onClick={() => handleSaveEdit(index)}
                                    className="p-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                                    title="저장"
                                  >
                                    <Check className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => { setEditingIndex(null); setEditForm(null); }}
                                    className="p-1.5 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors"
                                    title="취소"
                                  >
                                    취소
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-end space-x-1">
                                  <button
                                    onClick={() => handleStartEdit(index)}
                                    className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 transition-colors"
                                    title="수정"
                                  >
                                    <Edit3 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteEvent(index)}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                                    title="삭제"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 동기화 하단 배너 */}
              <div className="bg-indigo-600 rounded-2xl p-6 text-white flex flex-col sm:flex-row justify-between items-center gap-4 shadow-lg shadow-indigo-900/10">
                <div className="space-y-1 text-center sm:text-left">
                  <h4 className="text-lg font-bold">구글 캘린더 동기화</h4>
                  <p className="text-indigo-100 text-xs">
                    {user ? `${user.email} 계정으로 로그인됨 - '학교' 캘린더로 등록합니다.` : '일정 동기화를 위해 구글 로그인이 필요합니다.'}
                  </p>
                </div>
                {user ? (
                  <button
                    onClick={handleSyncToGoogleCalendar}
                    disabled={isSyncing || events.length === 0}
                    className="px-6 py-3 bg-white text-indigo-600 font-bold rounded-xl shadow-lg hover:bg-indigo-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isSyncing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>동기화 중 ({syncProgress.current}/{syncProgress.total})...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>'학교' 캘린더에 동기화 시작</span>
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={handleLogin}
                    disabled={isLoggingIn}
                    className="px-6 py-3 bg-white text-indigo-600 font-bold rounded-xl shadow-lg hover:bg-indigo-50 transition-all flex items-center gap-2"
                  >
                    <span>구글 로그인 후 동기화</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* 3단계: 완료 뷰 */}
          {step === 'complete' && syncResult && (
            <div className="bg-white rounded-3xl p-12 shadow-xs border border-slate-200 text-center max-w-xl mx-auto w-full space-y-6 my-auto">
              <div className="w-20 h-20 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">구글 캘린더 등록 완료!</h2>
                <p className="text-sm text-slate-600 leading-relaxed">
                  <span className="font-semibold text-slate-900">'{syncResult.calendarName}'</span> 캘린더가 생성되었으며, 총 <span className="font-semibold text-indigo-600">{syncResult.count}개의 일정</span>이 정상적으로 등록되었습니다.
                </p>
              </div>

              <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
                <a
                  href="https://calendar.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-all shadow-sm"
                >
                  <span>구글 캘린더 열기</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
                <button
                  onClick={() => {
                    setStep('upload');
                    setSelectedFile(null);
                    setEvents([]);
                    setSyncResult(null);
                  }}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold transition-colors"
                >
                  <span>다른 학사력 추가 업로드</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 하단 푸터 브랜딩 */}
        <footer className="mt-8 pt-4 border-t border-slate-200 flex justify-between items-center text-[11px] text-slate-400">
          <div className="flex gap-4">
            <span>개인정보 처리방침</span>
            <span>이용약관</span>
          </div>
          <div className="flex items-center gap-1 font-medium">
            Powered by <span className="text-indigo-500 font-bold uppercase tracking-tighter">Gemini AI</span>
          </div>
        </footer>
      </main>

      {/* API 설정 모달 */}
      <ApiSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}
