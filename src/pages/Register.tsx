import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/auth/AuthContext';
import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router';

export default function Register() {
  const { register } = useAuth(); const navigate = useNavigate();
  const [email, setEmail] = useState(''); const [displayName, setDisplayName] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState('');
  const submit = async (event: FormEvent) => { event.preventDefault(); setError(''); try { await register(email, displayName, password); navigate('/'); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to register'); } };
  return <main className="min-h-screen grid place-items-center px-6"><Card className="w-full max-w-md"><CardHeader><CardTitle>Create your SketchFlow account</CardTitle></CardHeader><CardContent><form className="grid gap-4" onSubmit={submit}><Input placeholder="Display name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} required /><Input type="email" placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} required /><Input type="password" placeholder="Password (8+ characters)" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required />{error && <p className="text-sm text-destructive">{error}</p>}<Button type="submit">Create account</Button><p className="text-sm text-muted-foreground">Already registered? <Link className="underline" to="/login">Log in</Link></p></form></CardContent></Card></main>;
}