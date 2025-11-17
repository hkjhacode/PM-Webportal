'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye, EyeOff, Copy, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface GeneratedCredentials {
  email: string;
  password: string;
  displayText: string;
  expiresAt: number;
}

interface CredentialsDisplayProps {
  tempCredentialsId: string;
  onClose: () => void;
}

export function CredentialsDisplay({ tempCredentialsId, onClose }: CredentialsDisplayProps) {
  const [credentials, setCredentials] = useState<GeneratedCredentials | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(30);
  const [isVisible, setIsVisible] = useState<boolean>(true);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Fetch temporary credentials
    fetchTemporaryCredentials();
    
    // Start countdown timer
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          // Hide credentials when time expires
          setCredentials(null);
          setIsVisible(false);
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [tempCredentialsId]);

  const fetchTemporaryCredentials = async () => {
    try {
      const response = await fetch(`/api/users/enhanced?tempCredentials=${tempCredentialsId}`);
      if (response.ok) {
        const data = await response.json();
        setCredentials(data);
      } else {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Failed to load credentials or they have expired'
        });
        onClose();
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load credentials'
      });
      onClose();
    }
  };

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      toast({
        title: 'Copied!',
        description: `${field} copied to clipboard`
      });
      setTimeout(() => setCopiedField(null), 2000);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to copy',
        description: 'Please copy manually'
      });
    }
  };

  const formatTimeLeft = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isVisible || !credentials) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Credentials Hidden</CardTitle>
          <CardDescription>
            The credentials have been hidden for security. They are no longer accessible.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={onClose} className="w-full">
            Close
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto border-orange-200 bg-orange-50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-orange-800">User Credentials</CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-orange-600">
              {formatTimeLeft(timeLeft)}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsVisible(!isVisible)}
              className="h-8 w-8 p-0"
            >
              {isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        <CardDescription className="text-orange-700">
          These credentials will be hidden in {timeLeft} seconds for security.
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <Alert className="border-orange-200 bg-orange-100">
          <AlertDescription className="text-orange-800">
            <strong>Important:</strong> Save these credentials now. They will not be shown again.
          </AlertDescription>
        </Alert>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-orange-800">Email</Label>
            <div className="flex gap-2">
              <Input
                id="email"
                value={isVisible ? credentials.email : '•••••••••••••••'}
                readOnly
                className="bg-white border-orange-200 text-orange-900"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => copyToClipboard(credentials.email, 'Email')}
                className="border-orange-200 text-orange-700 hover:bg-orange-100"
              >
                {copiedField === 'Email' ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-orange-800">Password</Label>
            <div className="flex gap-2">
              <Input
                id="password"
                type={isVisible ? "text" : "password"}
                value={isVisible ? credentials.password : '•••••••••'}
                readOnly
                className="bg-white border-orange-200 text-orange-900"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => copyToClipboard(credentials.password, 'Password')}
                className="border-orange-200 text-orange-700 hover:bg-orange-100"
              >
                {copiedField === 'Password' ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-orange-200">
          <Button 
            onClick={onClose} 
            className="w-full bg-orange-600 hover:bg-orange-700"
          >
            I've Saved the Credentials
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}