import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { canUseBrowserTts, cancelBrowserTts, speakWithBrowserTts } from "@/shared/lib/browserTts";
import { 
  Mic, 
  Play, 
  Pause, 
  Square, 
  Volume2,
  VolumeX,
  Download,
  FileText,
  Sparkles,
  Globe,
  Clock,
  Loader2,
  BookOpen,
  Languages
} from "lucide-react";

interface BriefingSection {
  id: string;
  title: string;
  content: string;
  audioUrl?: string;
  duration?: number;
}

interface Briefing {
  id: string;
  title: string;
  language: "en" | "ar";
  sections: BriefingSection[];
  totalDuration: number;
  createdAt: Date;
  status: "draft" | "generating" | "ready" | "error";
}

export function BriefingStudio() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const audioRef = useRef<HTMLAudioElement>(null);
  const usingBrowserTtsRef = useRef(false);
  
  const [topic, setTopic] = useState("");
  const [language, setLanguage] = useState<"en" | "ar">("en");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const [activeSectionIndex, setActiveSectionIndex] = useState(0);
  const [generatedBriefing, setGeneratedBriefing] = useState<Briefing | null>(null);
  const [audioSrc, _setAudioSrc] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      cancelBrowserTts();

      if (audioSrc?.startsWith("blob:")) {
        URL.revokeObjectURL(audioSrc);
      }
    };
  }, [audioSrc]);
  
  const detectLanguage = (text: string): "en" | "ar" => {
    const arabicPattern = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/;
    return arabicPattern.test(text) ? "ar" : "en";
  };

  const handleTopicChange = (value: string) => {
    setTopic(value);
    const detected = detectLanguage(value);
    if (detected !== language && value.length > 3) {
      setLanguage(detected);
    }
  };

  const generateBriefing = async () => {
    if (!topic.trim()) {
      toast({
        variant: "destructive",
        title: t('knowledge.briefingStudio.topicRequired'),
        description: t('knowledge.briefingStudio.enterTopicDescription'),
      });
      return;
    }

    setIsGenerating(true);
    
    try {
      const searchResponse = await fetch('/api/knowledge/enhanced-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: topic, topK: 5, useHybrid: true }),
        credentials: 'include',
      });
      
      const searchData = await searchResponse.json();
      const documents = searchData.success ? searchData.data?.results || [] : [];
      
      const briefingContent: Briefing = {
        id: `briefing-${Date.now()}`,
        title: topic,
        language,
        status: "ready",
        totalDuration: 180,
        createdAt: new Date(),
        sections: [
          {
            id: "s1",
            title: language === "ar" ? "ملخص تنفيذي" : t('knowledge.briefingStudio.executiveSummary'),
            content: language === "ar" 
              ? `تحليل شامل حول ${topic}. تم استخراج المعلومات من ${documents.length} وثيقة ذات صلة في قاعدة المعرفة.`
              : t('knowledge.briefingStudio.executiveSummaryContent', { topic, count: documents.length }),
            duration: 45
          },
          {
            id: "s2",
            title: language === "ar" ? "النتائج الرئيسية" : t('knowledge.briefingStudio.keyFindings'),
            content: language === "ar"
              ? `النتائج المستخلصة من الوثائق ذات الصلة تشير إلى عدة نقاط مهمة حول ${topic}.`
              : documents.length > 0 
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ? t('knowledge.briefingStudio.keyFindingsContent', { count: documents.length, sources: documents.slice(0, 3).map((d: any) => d.title || d.filename).join(', ') })
                : t('knowledge.briefingStudio.keyFindingsGeneric', { topic }),
            duration: 60
          },
          {
            id: "s3",
            title: language === "ar" ? "التوصيات" : t('knowledge.briefingStudio.recommendations'),
            content: language === "ar"
              ? "التوصيات الاستراتيجية بناءً على التحليل وأفضل الممارسات المحددة في الوثائق."
              : t('knowledge.briefingStudio.recommendationsContent'),
            duration: 45
          },
          {
            id: "s4",
            title: language === "ar" ? "الخطوات التالية" : t('knowledge.briefingStudio.nextSteps'),
            content: language === "ar"
              ? "خطة العمل المقترحة للمضي قدماً، بما في ذلك الجداول الزمنية والمسؤوليات."
              : t('knowledge.briefingStudio.nextStepsContent'),
            duration: 30
          }
        ]
      };
      
      setGeneratedBriefing(briefingContent);
      toast({
        title: language === "ar" ? "تم إنشاء الإحاطة" : t('knowledge.briefingStudio.briefingGenerated'),
        description: language === "ar" 
          ? `تم تحليل ${documents.length} وثيقة - جاهز للاستماع`
          : t('knowledge.briefingStudio.briefingGeneratedDescription', { count: documents.length }),
      });
    } catch (_error) {
      toast({
        variant: "destructive",
        title: t('knowledge.briefingStudio.generationFailed'),
        description: t('knowledge.briefingStudio.generationFailedDescription'),
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePlayPause = async () => {
    if (!generatedBriefing) return;
    
    if (isPlaying) {
      if (usingBrowserTtsRef.current) {
        cancelBrowserTts();
        usingBrowserTtsRef.current = false;
      }

      if (audioRef.current) {
        audioRef.current.pause();
      }
      setIsPlaying(false);
      return;
    }

    try {
      const section = generatedBriefing.sections[activeSectionIndex];
      if (!section) return;
      const textToSpeak = `${section.title}. ${section.content}`;
      usingBrowserTtsRef.current = false;

      if (!canUseBrowserTts()) {
        throw new Error("Browser speech synthesis is unavailable");
      }

      usingBrowserTtsRef.current = true;
      setIsPlaying(true);
      setCurrentTime(0);
      setDuration(0);
      await speakWithBrowserTts({
        text: textToSpeak,
        language: language === "ar" ? "ar-AE" : "en-GB",
      });
      usingBrowserTtsRef.current = false;
      setIsPlaying(false);
    } catch (_error) {
      usingBrowserTtsRef.current = false;
      setIsPlaying(false);
      toast({
        variant: "destructive",
        title: t('knowledge.briefingStudio.audioFailed'),
        description: t('knowledge.briefingStudio.audioFailedDescription'),
      });
    }
  };

  const handleStop = () => {
    if (usingBrowserTtsRef.current) {
      cancelBrowserTts();
      usingBrowserTtsRef.current = false;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleDownload = () => {
    if (!audioSrc) {
      toast({
        variant: "destructive",
        title: t('knowledge.briefingStudio.noAudioAvailable'),
        description: t('knowledge.briefingStudio.noAudioAvailableDescription'),
      });
      return;
    }

    const link = document.createElement("a");
    link.href = audioSrc;
    link.download = `briefing-${generatedBriefing?.id || Date.now()}.wav`;
    link.click();
  };

  const handleVolumeChange = (value: number[]) => {
    const vol = value[0] ?? volume;
    setVolume(vol);
    if (audioRef.current) {
      audioRef.current.volume = vol / 100;
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Mic className="h-6 w-6 text-primary" />
            {language === "ar" ? "استوديو الإحاطات" : t('knowledge.briefingStudio.title')}
          </h2>
          <p className="text-muted-foreground mt-1" dir={language === "ar" ? "rtl" : "ltr"}>
            {language === "ar" 
              ? "حول معرفتك إلى إحاطات صوتية باللغة العربية أو الإنجليزية"
              : t('knowledge.briefingStudio.subtitle')
            }
          </p>
        </div>
        <Badge variant="secondary" className="flex items-center gap-1">
          <Languages className="h-3 w-3" />
          {language === "ar" ? "العربية" : "English"}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              {language === "ar" ? "إنشاء إحاطة" : t('knowledge.briefingStudio.createBriefing')}
            </CardTitle>
            <CardDescription>
              {language === "ar" 
                ? "أدخل موضوعك لإنشاء إحاطة صوتية"
                : t('knowledge.briefingStudio.createBriefingDescription')
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{language === "ar" ? "الموضوع" : t('knowledge.briefingStudio.topic')}</Label>
              <Textarea
                placeholder={language === "ar" 
                  ? "مثال: التحول الرقمي في القطاع الحكومي..."
                  : t('knowledge.briefingStudio.topicPlaceholder')
                }
                value={topic}
                onChange={(e) => handleTopicChange(e.target.value)}
                className="min-h-[100px]"
                dir={language === "ar" ? "rtl" : "ltr"}
                data-testid="input-briefing-topic"
              />
              <p className="text-xs text-muted-foreground">
                {language === "ar" 
                  ? "اكتب بالعربية أو الإنجليزية - سيتم اكتشاف اللغة تلقائياً"
                  : t('knowledge.briefingStudio.languageAutoDetect')
                }
              </p>
            </div>
            
            <div className="flex gap-4">
              <div className="flex-1 space-y-2">
                <Label>{language === "ar" ? "اللغة" : t('knowledge.briefingStudio.language')}</Label>
                <Select value={language} onValueChange={(v: "en" | "ar") => setLanguage(v)}>
                  <SelectTrigger data-testid="select-language">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        English (British)
                      </div>
                    </SelectItem>
                    <SelectItem value="ar">
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        العربية
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button 
              onClick={generateBriefing}
              disabled={isGenerating || !topic.trim()}
              className="w-full"
              data-testid="button-generate-briefing"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {language === "ar" ? "جاري الإنشاء..." : t('knowledge.briefingStudio.generating')}
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  {language === "ar" ? "إنشاء الإحاطة" : t('knowledge.briefingStudio.generateBriefing')}
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Volume2 className="h-5 w-5" />
              {language === "ar" ? "مشغل الصوت" : t('knowledge.briefingStudio.audioPlayer')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {generatedBriefing ? (
              <div className="space-y-4">
                <div className="p-4 bg-gradient-to-br from-primary/10 to-blue-500/10 rounded-xl">
                  <h4 className="font-semibold" dir={language === "ar" ? "rtl" : "ltr"}>
                    {generatedBriefing.title}
                  </h4>
                  <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatTime(generatedBriefing.totalDuration)}
                    </span>
                    <span className="flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      {generatedBriefing.sections.length} {t('knowledge.briefingStudio.sections')}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Progress value={(currentTime / duration) * 100 || 0} className="h-2" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration || generatedBriefing.totalDuration)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-4">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleMute}
                    data-testid="button-mute"
                  >
                    {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                  </Button>
                  
                  <div className="w-24">
                    <Slider
                      value={[isMuted ? 0 : volume]}
                      max={100}
                      step={1}
                      onValueChange={handleVolumeChange}
                    />
                  </div>
                  
                  <Button
                    size="lg"
                    className="rounded-full h-14 w-14"
                    onClick={handlePlayPause}
                    data-testid="button-play-pause"
                  >
                    {isPlaying ? (
                      <Pause className="h-6 w-6" />
                    ) : (
                      <Play className="h-6 w-6 ml-1" />
                    )}
                  </Button>
                  
                  <Button variant="ghost" size="icon" onClick={handleStop} data-testid="button-stop">
                    <Square className="h-5 w-5" />
                  </Button>
                  
                  <Button variant="ghost" size="icon" onClick={handleDownload} data-testid="button-download">
                    <Download className="h-5 w-5" />
                  </Button>
                </div>
                <audio ref={audioRef} className="hidden" preload="auto" />

                <div className="space-y-2 mt-4">
                  <Label className="text-sm font-medium">
                    {language === "ar" ? "الأقسام" : t('knowledge.briefingStudio.sectionsLabel')}
                  </Label>
                  <ScrollArea className="h-48">
                    <div className="space-y-2">
                      {generatedBriefing.sections.map((section, index) => (
                        <div
                          key={section.id}
                          className={`p-3 rounded-lg border cursor-pointer transition-all ${
                            index === activeSectionIndex
                              ? 'bg-primary/10 border-primary'
                              : 'bg-muted/30 hover:bg-muted/50'
                          }`}
                          onClick={() => {
                            setActiveSectionIndex(index);
                            handleStop();
                          }}
                          dir={language === "ar" ? "rtl" : "ltr"}
                          data-testid={`section-${section.id}`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm">{section.title}</span>
                            <Badge variant="outline" className="text-xs">
                              {formatTime(section.duration || 0)}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {section.content}
                          </p>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center text-center">
                <Mic className="h-12 w-12 text-muted-foreground mb-4" />
                <h4 className="font-medium">
                  {language === "ar" ? "لا توجد إحاطة بعد" : t('knowledge.briefingStudio.noBriefingYet')}
                </h4>
                <p className="text-sm text-muted-foreground mt-1">
                  {language === "ar"
                    ? "أنشئ إحاطة للاستماع إليها هنا"
                    : t('knowledge.briefingStudio.generateToListen')
                  }
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {generatedBriefing && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              {language === "ar" ? "نص الإحاطة" : t('knowledge.briefingStudio.briefingTranscript')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div 
              className="prose dark:prose-invert max-w-none" 
              dir={language === "ar" ? "rtl" : "ltr"}
            >
              {generatedBriefing.sections.map((section, index) => (
                <div 
                  key={section.id}
                  className={`p-4 rounded-lg mb-4 ${
                    index === activeSectionIndex 
                      ? 'bg-primary/5 border-l-4 border-primary' 
                      : 'bg-muted/20'
                  }`}
                >
                  <h3 className="text-lg font-semibold mb-2">{section.title}</h3>
                  <p className="text-muted-foreground">{section.content}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
