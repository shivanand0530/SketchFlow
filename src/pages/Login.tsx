import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/auth/AuthContext';
import { FormEvent, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError('');
    try { await login(email, password); const returnTo = new URLSearchParams(location.search).get('returnTo') ?? '/'; navigate(returnTo); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to log in'); }
  };
  return <main className="min-h-screen grid place-items-center px-6"><Card className="w-full max-w-md"><CardHeader><CardTitle>Log in to SketchFlow</CardTitle></CardHeader><CardContent><form className="grid gap-4" onSubmit={submit}><Input type="email" placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} required /><Input type="password" placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} required />{error && <p className="text-sm text-destructive">{error}</p>}<Button type="submit">Log in</Button><p className="text-sm text-muted-foreground">New to SketchFlow? <Link className="underline" to="/register">Create an account</Link></p></form></CardContent></Card></main>;
}