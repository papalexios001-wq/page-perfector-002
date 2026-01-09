// src/components/config/LlmsTxtGenerator.tsx
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Bot, Download, Upload, Copy, CheckCircle2, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useConfigStore } from '@/stores/config-store';
import { invokeEdgeFunction } from '@/lib/supabase';
import { toast } from 'sonner';

export function LlmsTxtGenerator() {
  const { wordpress, siteContext } = useConfigStore();
  const [llmsTxt, setLlmsTxt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const handleGenerate = async () => {
    setIsGenerating(true);
    
    const { data, error } = await invokeEdgeFunction('generate-llms-txt', {
      siteUrl: wordpress.siteUrl,
      siteName: siteContext.organizationName || 'Your Site',
      siteDescription: `${siteContext.industry || 'Business'} resource for ${siteContext.targetAudience || 'professionals'}`,
      pages: [], // Would fetch from your pages table
      faqs: [],
      contactInfo: {},
      authorInfo: {
        name: siteContext.authorName || 'Editorial Team',
        bio: 'Expert content creators',
      },
    });

    if (error) {
      toast.error('Failed to generate llms.txt');
      setIsGenerating(false);
      return;
    }

    setLlmsTxt(data?.llmsTxt || '');
    toast.success('llms.txt generated!');
    setIsGenerating(false);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(llmsTxt);
    setIsCopied(true);
    toast.success('Copied to clipboard!');
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([llmsTxt], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'llms.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="glass-panel border-border/50">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-500/20">
            <Bot className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <CardTitle className="text-lg">LLMs.txt Generator</CardTitle>
            <CardDescription>
              Create an AI-friendly file to boost GEO/AEO visibility
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={handleGenerate} disabled={isGenerating} className="w-full gap-2">
          {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />}
          {isGenerating ? 'Generating...' : 'Generate llms.txt'}
        </Button>

        {llmsTxt && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            <Textarea 
              value={llmsTxt} 
              readOnly 
              className="h-64 font-mono text-xs bg-muted/50"
            />
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleCopy} className="gap-2">
                {isCopied ? <CheckCircle2 className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                {isCopied ? 'Copied!' : 'Copy'}
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownload} className="gap-2">
                <Download className="w-4 h-4" />
                Download
              </Button>
            </div>
          </motion.div>
        )}

        <div className="p-3 rounded-lg bg-info/10 border border-info/30 text-xs">
          <p className="font-medium text-info mb-1">📍 Where to upload:</p>
          <code className="text-muted-foreground">{wordpress.siteUrl || 'https://yoursite.com'}/llms.txt</code>
          <p className="mt-2 text-muted-foreground">
            Upload to your WordPress root directory (same folder as wp-config.php)
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

