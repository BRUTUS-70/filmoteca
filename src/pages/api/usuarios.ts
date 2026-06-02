// src/pages/api/usuarios.ts
export const prerender = false;

import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

if (typeof globalThis.WebSocket === 'undefined') {
    globalThis.WebSocket = class {} as any;
}

function generateTempPassword() {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-*&%$";
    let pass = "";
    for (let i = 0; i < 8; i++) {
        pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pass;
}

export const POST: APIRoute = async ({ request }) => {
    const headers = { "Content-Type": "application/json" };

    try {
        const body = await request.json();
        // CORRECCIÓN: Extraer 'nombre' del body
        const { id, email, nombre, rol, avatar, password } = body;

        const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
        const supabaseServiceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseServiceKey) {
            return new Response(JSON.stringify({ error: "Falta la clave SUPABASE_SERVICE_ROLE_KEY." }), { status: 500, headers });
        }

        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
            auth: { autoRefreshToken: false, persistSession: false }
        });

        if (id) {
            // ACTUALIZACIÓN DE USUARIO EXISTENTE
            const updatePayload: any = { email };
            if (rol !== undefined) updatePayload.rol = rol;
            if (avatar !== undefined) updatePayload.avatar = avatar;
            // CORRECCIÓN: Añadir 'nombre' al payload de actualización
            if (nombre !== undefined) updatePayload.nombre = nombre;

            const { error: updateError } = await supabaseAdmin.from('perfiles').update(updatePayload).eq('id', id);
            if (updateError) throw updateError;

            if (password && password.length >= 6) {
                const { error: passError } = await supabaseAdmin.auth.admin.updateUserById(id, { password });
                if (passError) throw passError;
            }

            return new Response(JSON.stringify({ success: true, message: "Perfil actualizado correctamente." }), { status: 200, headers });
        } 
        else {
            // CREACIÓN DE NUEVO USUARIO
            const tempPassword = (password && password.length >= 6) ? password : generateTempPassword();
            
            console.log(`[AUTH] Invitando a ${email}. Contraseña temporal generada: ${tempPassword}`);

            const { data: authData, error: authError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
                data: { codigo_acceso: tempPassword, nombre: nombre }
            });
            
            if (authError) throw authError;

            const newUserId = authData.user?.id;
            if (!newUserId) throw new Error("No se pudo obtener el ID del usuario creado.");

            const { error: passError } = await supabaseAdmin.auth.admin.updateUserById(newUserId, { 
                password: tempPassword,
                email_confirm: true 
            });
            
            if (passError) throw passError;

            const insertPayload: any = { 
                id: newUserId, 
                email, 
                password_changed: false
            };
            if (rol !== undefined) insertPayload.rol = rol;
            if (avatar !== undefined) insertPayload.avatar = avatar;
            // CORRECCIÓN: Añadir 'nombre' al payload de inserción
            if (nombre !== undefined) insertPayload.nombre = nombre;

            const { error: dbError } = await supabaseAdmin.from('perfiles').upsert(insertPayload, { onConflict: 'id' });
            
            if (dbError) throw dbError;

            return new Response(JSON.stringify({ success: true, message: "Invitación enviada y perfil creado." }), { status: 200, headers });
        }
    } catch (error: any) {
        console.error("[ERROR API USUARIOS POST]:", error);
        return new Response(JSON.stringify({ error: error.message || "Error interno del servidor" }), { status: 400, headers });
    }
};

export const DELETE: APIRoute = async ({ request }) => {
    const headers = { "Content-Type": "application/json" };

    try {
        const body = await request.json();
        const { id } = body;

        const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
        const supabaseServiceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseServiceKey) {
            return new Response(JSON.stringify({ error: "Falta la clave SUPABASE_SERVICE_ROLE_KEY." }), { status: 500, headers });
        }

        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
            auth: { autoRefreshToken: false, persistSession: false }
        });

        if (!id) throw new Error("ID de usuario no proporcionado");

        // 1. Borramos el perfil de la base de datos pública
        const { error: dbError } = await supabaseAdmin.from('perfiles').delete().eq('id', id);
        if (dbError) throw dbError;

        // 2. Destruimos al usuario en el sistema Auth (Esto evita futuros errores 400)
        const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id);
        if (authError) throw authError;

        return new Response(JSON.stringify({ success: true, message: "Usuario eliminado completamente." }), { status: 200, headers });
    } catch (error: any) {
        console.error("[ERROR API USUARIOS DELETE]:", error);
        return new Response(JSON.stringify({ error: error.message || "Error interno del servidor" }), { status: 400, headers });
    }
};
