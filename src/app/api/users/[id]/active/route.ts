import { NextRequest, NextResponse } from 'next/server';
import { getUserById, saveUser } from '@/lib/actions/user-actions';
import { revalidatePath } from 'next/cache';

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));
    const nextActive = Boolean(body?.active);
    const user = await getUserById(id);
    if (!user) return NextResponse.json({ success: false, message: 'Usuario no encontrado' }, { status: 404 });

    const res = await saveUser({
      email: user.email,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      permissions: user.permissions,
      active: nextActive,
    } as any, id);

    if (!res?.success) {
      return NextResponse.json({ success: false, message: res?.message || 'Error al actualizar' }, { status: 500 });
    }
    revalidatePath('/users');
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[API] POST /api/users/[id]/active error', err);
    return NextResponse.json({ success: false, message: 'Error interno' }, { status: 500 });
  }
}
