import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  Star,
  Bookmark as _Bookmark,
  Share2,
  Flag as _Flag,
  Users,
  TrendingUp,
  Award,
  Sparkles,
  Send,
  Edit2 as _Edit2,
  MoreVertical as _MoreVertical,
  Clock,
  Eye as _Eye,
  Heart,
  Lightbulb,
  CheckCircle2
} from "lucide-react";

interface Annotation {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  content: string;
  createdAt: Date;
  likes: number;
  isExpert: boolean;
  type: "comment" | "insight" | "question" | "suggestion";
}

interface _DocumentRating {
  userId: string;
  rating: number;
  helpful: boolean;
}

interface TopContributor {
  id: string;
  name: string;
  avatar?: string;
  contributions: number;
  expertise: string[];
  reputation: number;
}

interface CollaborativeAnnotationsProps {
  documentId?: string;
  documentName?: string;
}

const getTypeIcon = (type: string) => {
  switch (type) {
    case "insight": return <Lightbulb className="h-4 w-4 text-amber-500" />;
    case "question": return <MessageSquare className="h-4 w-4 text-blue-500" />;
    case "suggestion": return <Sparkles className="h-4 w-4 text-purple-500" />;
    default: return <MessageSquare className="h-4 w-4 text-muted-foreground" />;
  }
};

const getTypeBadge = (type: string, t: (key: string) => string) => {
  switch (type) {
    case "insight": return <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">{t('knowledge.annotations.insight')}</Badge>;
    case "question": return <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">{t('knowledge.annotations.question')}</Badge>;
    case "suggestion": return <Badge variant="secondary" className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">{t('knowledge.annotations.suggestion')}</Badge>;
    default: return <Badge variant="outline">{t('knowledge.annotations.comment')}</Badge>;
  }
};


export function CollaborativeAnnotations({ documentId: _documentId, documentName: _documentName }: CollaborativeAnnotationsProps) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [topContributors, setTopContributors] = useState<TopContributor[]>([]);
  const [newComment, setNewComment] = useState("");
  const [commentType, setCommentType] = useState<"comment" | "insight" | "question" | "suggestion">("comment");
  const [userRating, setUserRating] = useState<number>(0);
  const [isHelpful, setIsHelpful] = useState<boolean | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: currentUser } = useQuery<{ success: boolean; data: any }>({
    queryKey: ['/api/auth/me'],
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: documents } = useQuery<{ success: boolean; data: any[] }>({
    queryKey: ['/api/knowledge/documents'],
  });

  useEffect(() => {
    if (documents?.data && documents.data.length > 0) {
      const uploaders = Array.from(new Set(documents.data.map(d => d.uploaderName).filter(Boolean)));
      const contributors: TopContributor[] = uploaders.slice(0, 5).map((name, idx) => ({
        id: `c${idx}`,
        name: name as string,
        contributions: documents.data.filter(d => d.uploaderName === name).length,
        expertise: documents.data.filter(d => d.uploaderName === name).slice(0, 2).map(d => d.category).filter(Boolean),
        reputation: 300 + (documents.data.filter(d => d.uploaderName === name).length * 50)
      }));

      const initialAnnotations: Annotation[] = documents.data.slice(0, 4).map((doc, idx) => ({
        id: `a${idx}`,
        userId: doc.uploadedBy,
        userName: doc.uploaderName || "Team Member",
        content: `Uploaded: ${doc.filename} - ${doc.category || 'General'} document for team reference.`,
        createdAt: new Date(doc.uploadedAt),
        likes: idx + 1,
        isExpert: idx < 2,
        type: (idx === 0 ? "insight" : idx === 1 ? "comment" : idx === 2 ? "suggestion" : "question") as Annotation["type"]
      }));

      setAnnotations(initialAnnotations);
      setTopContributors(contributors);
    }
  }, [documents]);

  const handleAddAnnotation = () => {
    if (!newComment.trim()) return;

    const userName = currentUser?.data?.displayName || currentUser?.data?.email || "Current User";

    const newAnnotation: Annotation = {
      id: `a${Date.now()}`,
      userId: currentUser?.data?.id || "current-user",
      userName,
      content: newComment,
      createdAt: new Date(),
      likes: 0,
      isExpert: false,
      type: commentType
    };

    setAnnotations(prev => [newAnnotation, ...prev]);
    setNewComment("");

    toast({
      title: t('knowledge.annotations.annotationAdded'),
      description: t('knowledge.annotations.annotationAddedDescription'),
    });
  };

  const handleLike = (annotationId: string) => {
    setAnnotations(prev => prev.map(a =>
      a.id === annotationId ? { ...a, likes: a.likes + 1 } : a
    ));
  };

  const handleRate = (rating: number) => {
    setUserRating(rating);
    toast({
      title: t('knowledge.annotations.ratingSaved'),
      description: t('knowledge.annotations.ratingSavedDescription', { rating }),
    });
  };

  const handleHelpful = (helpful: boolean) => {
    setIsHelpful(helpful);
    toast({
      title: t('knowledge.annotations.feedbackRecorded'),
      description: helpful ? t('knowledge.annotations.gladHelpful') : t('knowledge.annotations.thanksFeedback'),
    });
  };

  const formatTimeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return t('knowledge.annotations.justNow');
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return t('knowledge.annotations.minutesAgo', { count: minutes });
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return t('knowledge.annotations.hoursAgo', { count: hours });
    const days = Math.floor(hours / 24);
    return t('knowledge.annotations.daysAgo', { count: days });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            {t('knowledge.annotations.title')}
          </h2>
          <p className="text-muted-foreground mt-1">
            {t('knowledge.annotations.subtitle')}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('knowledge.annotations.annotationsLabel')}</p>
                <p className="text-2xl font-bold">{annotations.length}</p>
              </div>
              <MessageSquare className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('knowledge.annotations.expertInsights')}</p>
                <p className="text-2xl font-bold">{annotations.filter(a => a.isExpert).length}</p>
              </div>
              <Award className="h-8 w-8 text-amber-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('knowledge.annotations.avgRating')}</p>
                <p className="text-2xl font-bold">4.6</p>
              </div>
              <Star className="h-8 w-8 text-emerald-500 fill-emerald-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('knowledge.annotations.contributors')}</p>
                <p className="text-2xl font-bold">{topContributors.length}</p>
              </div>
              <Users className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                {t('knowledge.annotations.addContribution')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                {(["comment", "insight", "question", "suggestion"] as const).map((type) => (
                  <Button
                    key={type}
                    variant={commentType === type ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCommentType(type)}
                    data-testid={`button-type-${type}`}
                  >
                    {getTypeIcon(type)}
                    <span className="ml-1 capitalize">{type}</span>
                  </Button>
                ))}
              </div>

              <div className="flex gap-2">
                <Textarea
                  placeholder={
                    commentType === "question"
                      ? t('knowledge.annotations.askQuestion')
                      : commentType === "insight"
                      ? t('knowledge.annotations.shareInsight')
                      : commentType === "suggestion"
                      ? t('knowledge.annotations.suggestImprovement')
                      : t('knowledge.annotations.addComment')
                  }
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="flex-1"
                  data-testid="input-annotation"
                />
              </div>

              <Button
                onClick={handleAddAnnotation}
                disabled={!newComment.trim()}
                className="w-full"
                data-testid="button-submit-annotation"
              >
                <Send className="h-4 w-4 mr-2" />
                {t('knowledge.annotations.share')} {commentType.charAt(0).toUpperCase() + commentType.slice(1)}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  {t('knowledge.annotations.communityAnnotations')}
                </CardTitle>
                <Badge variant="secondary">{t('knowledge.annotations.contributions', { count: annotations.length })}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-4">
                  {annotations.map((annotation) => (
                    <div
                      key={annotation.id}
                      className="p-4 rounded-lg border bg-card"
                      data-testid={`annotation-${annotation.id}`}
                    >
                      <div className="flex items-start gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback>
                            {annotation.userName.split(" ").map(n => n[0]).join("")}
                          </AvatarFallback>
                        </Avatar>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold">{annotation.userName}</span>
                            {annotation.isExpert && (
                              <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                <Award className="h-3 w-3 mr-1" />
                                {t('knowledge.annotations.expert')}
                              </Badge>
                            )}
                            {getTypeBadge(annotation.type, t)}
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatTimeAgo(annotation.createdAt)}
                            </span>
                          </div>

                          <p className="mt-2 text-sm">{annotation.content}</p>

                          <div className="flex items-center gap-4 mt-3">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleLike(annotation.id)}
                              className="text-muted-foreground hover:text-primary"
                              data-testid={`button-like-${annotation.id}`}
                            >
                              <Heart className="h-4 w-4 mr-1" />
                              {annotation.likes}
                            </Button>
                            <Button variant="ghost" size="sm" className="text-muted-foreground">
                              <MessageSquare className="h-4 w-4 mr-1" />
                              {t('knowledge.annotations.reply')}
                            </Button>
                            <Button variant="ghost" size="sm" className="text-muted-foreground">
                              <Share2 className="h-4 w-4 mr-1" />
                              {t('knowledge.annotations.shareAction')}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="h-5 w-5" />
                {t('knowledge.annotations.rateDocument')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Button
                    key={star}
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRate(star)}
                    className={star <= userRating ? "text-amber-500" : "text-muted-foreground"}
                    data-testid={`button-star-${star}`}
                  >
                    <Star className={`h-6 w-6 ${star <= userRating ? "fill-amber-500" : ""}`} />
                  </Button>
                ))}
              </div>

              <Separator />

              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">{t('knowledge.annotations.wasHelpful')}</p>
                <div className="flex justify-center gap-2">
                  <Button
                    variant={isHelpful === true ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleHelpful(true)}
                    data-testid="button-helpful-yes"
                  >
                    <ThumbsUp className="h-4 w-4 mr-1" />
                    {t('knowledge.annotations.yes')}
                  </Button>
                  <Button
                    variant={isHelpful === false ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleHelpful(false)}
                    data-testid="button-helpful-no"
                  >
                    <ThumbsDown className="h-4 w-4 mr-1" />
                    {t('knowledge.annotations.no')}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                {t('knowledge.annotations.topContributors')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {topContributors.map((contributor: TopContributor, index: number) => (
                  <div
                    key={contributor.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="relative">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className={
                          index === 0 ? "bg-amber-100 text-amber-700" :
                          index === 1 ? "bg-slate-100 text-slate-700" :
                          "bg-orange-100 text-orange-700"
                        }>
                          {contributor.name.split(" ").map(n => n[0]).join("")}
                        </AvatarFallback>
                      </Avatar>
                      {index < 3 && (
                        <div className={`absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                          index === 0 ? "bg-amber-500 text-white" :
                          index === 1 ? "bg-slate-400 text-white" :
                          "bg-orange-400 text-white"
                        }`}>
                          {index + 1}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{contributor.name}</p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Award className="h-3 w-3" />
                        {contributor.reputation} {t('knowledge.annotations.reputation')}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{contributor.contributions}</p>
                      <p className="text-xs text-muted-foreground">{t('knowledge.annotations.posts')}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-primary/5 to-blue-500/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                <div>
                  <h4 className="font-semibold text-sm">{t('knowledge.annotations.verifiedContent')}</h4>
                  <p className="text-xs text-muted-foreground">
                    {t('knowledge.annotations.verifiedContentDescription')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
