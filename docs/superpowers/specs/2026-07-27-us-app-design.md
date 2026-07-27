# Us — Diseño de la aplicación (Fase 1: pareja)

**Fecha:** 2026-07-27
**Estado:** Aprobado para pasar a plan de implementación

## 1. Resumen

"Us" es una PWA (web app instalable, mobile-first) que centraliza la vida compartida de una pareja en tres módulos: viajes, retos y objetivos. Cada persona se registra con su propia cuenta y pertenece a un "space" compartido. El modelo de datos se diseña alrededor de `space` (no de "pareja"), de forma que más adelante pueda soportar grupos de más de 2 personas sin rediseñar la base de datos — solo cambiando la interfaz de invitación y las reglas de negocio.

**Fuera de alcance en esta fase:** multi-grupo real (un mismo usuario en varios spaces, tipos de space, roles/permisos), app nativa, notificaciones push, itinerario/presupuesto de viaje tipo trip-planner clásico.

## 2. Plataforma y stack

- **Frontend:** Next.js (React) + Tailwind CSS. PWA instalable (manifest + service worker básico), mobile-first.
- **Backend / datos / auth:** Supabase — Postgres gestionado, autenticación de usuarios (email/password), Storage para fotos, Row Level Security (RLS) para aislar los datos de cada space.
- **Hosting:** Vercel (frontend, capa gratuita) + Supabase (capa gratuita).
- **Regla de seguridad multi-tenant:** toda política RLS se basa en "¿el usuario pertenece al space que intenta consultar?" (vía `space_members`), nunca en una comparación directa entre dos IDs de usuario fijos. Esto es lo que permite escalar de 2 a N miembros sin tocar las políticas.

Justificación (frente a Firebase/Firestore): los datos de esta app son relacionales por naturaleza (un reto pertenece a un space, tiene participantes, genera puntos y logros; un objetivo tiene hitos). Postgres + RLS modela esto de forma más directa que una base NoSQL, y Supabase evita escribir auth y control de acceso a mano, algo crítico para quien empieza de cero en programación.

## 3. Navegación

Barra de navegación inferior fija (patrón estándar mobile/PWA), 5 destinos: **Inicio · Viajes · Retos · Objetivos · Perfil**. Escalable: cuando el proyecto pase a multi-space, se puede añadir un selector de space sin cambiar esta estructura.

## 4. Modelo de datos

### Núcleo (usuarios y spaces)
- **users**: id, email, name, avatar_url, created_at. Gestionada en gran parte por Supabase Auth.
- **spaces**: id, name, type (`couple` por ahora, para dejar el campo listo), invite_code (único), created_at.
- **space_members**: space_id, user_id, role (`owner` | `member`), joined_at. Añadir un miembro nuevo es solo insertar una fila — esta tabla es la pieza clave de la escalabilidad.

### Módulo Viajes (mapa de sitios, no trip-planner)
- **places**: id, name, scope (`spain` | `europe` | `world`).
- **place_visits**: id, place_id, space_id, visited_at, note.
- **place_visit_participants**: visit_id, user_id — uno o dos registros por visita; dos = "visitado juntos", uno = visita individual.
- **visit_photos**: id, visit_id, url (Supabase Storage), uploaded_by.
- **place_wishlist**: id, place_id, space_id, user_id, rank — ranking personal de cada miembro; la app resalta cuando un sitio aparece en el ranking de ambos.

### Módulo Retos
- **challenges**: id, space_id, title, description, kind (`one_off` | `streak`), points (elegido libremente por quien crea el reto, sin tabla de puntuación fija), status (`pending_acceptance` | `active` | `completed` | `declined`), created_by, assigned_to (nullable = para ambos).
- **challenge_completions**: id, challenge_id, user_id, completed_at — una fila por finalización; en retos tipo racha, varias filas a lo largo del tiempo permiten calcular la racha actual.
- **achievements**: id, code, name, icon, criteria (descripción del hito que lo desbloquea).
- **user_achievements**: id, space_id, user_id, achievement_id, unlocked_at.

### Módulo Objetivos
- **goals**: id, space_id, title, category (`savings` | `habit` | `life`), status, created_by, y según categoría: target_amount/current_amount (savings), o ninguno adicional (life/habit, que usan las tablas de abajo).
- **goal_milestones**: id, goal_id, title, completed (bool), completed_at — hitos de objetivos tipo "vida/relación".
- **habit_checkins**: id, goal_id, user_id, date — marca de constancia para objetivos tipo "hábito"; permite calcular racha igual que en retos.

### Fase 2 (no se implementa en el MVP, pero el modelo ya lo soporta)
- **activity_feed**: id, space_id, user_id, event_type, content, created_at.

## 5. Reglas de visibilidad

Por defecto todo el contenido de un space es visible para todos sus miembros. Excepción: un reto en estado `pending_acceptance` solo es visible en detalle para quien lo creó y quien debe aceptarlo — el resto de miembros del space (en fases futuras con >2 personas) no lo ven hasta que se acepta. Esto cubre el caso de "reto sorpresa" sin necesitar un sistema de privacidad más general.

## 6. Alta e invitación

1. Un usuario se registra (email/password vía Supabase Auth) y crea un space, quedando como `owner`.
2. La app genera un `invite_code` único para ese space.
3. La pareja se registra con su propio email/password y, al introducir el código, se crea su fila en `space_members` con role `member`. En esta fase el código es de un solo uso por space (basta con una invitación); no hace falta expiración ni límite de usos configurable.

Este flujo (código de invitación, no alta manual) es el que escala a grupos más grandes en el futuro sin cambios estructurales.

## 7. Módulos — comportamiento esperado (MVP)

**Viajes:** dos pestañas, "Visitados" y "Pendientes", filtrables por zona (España/Europa/Mundo). Añadir un sitio visitado permite marcar si fue en solitario o en pareja, fecha y subir fotos. En "Pendientes", cada miembro mantiene su propio ranking de sitios deseados; la interfaz destaca coincidencias entre los rankings de ambos miembros.

**Retos:** cualquier miembro puede proponer un reto (puntual o de racha) para el otro o para ambos. Queda `pending_acceptance` hasta que el destinatario lo acepta o rechaza. Al completarse, suma puntos a quien lo completó; los logros se desbloquean automáticamente al cumplir criterios (ej. "10 retos completados", "racha de 4 semanas"). Un marcador simple compara puntos totales entre miembros.

**Objetivos:** un objetivo se crea con una categoría (ahorro / hábito / vida-relación), que determina cómo se mide el progreso: ahorro con barra numérica hacia una cantidad objetivo, hábito con racha de constancia (check-ins), vida/relación con checklist de hitos y % calculado.

**Inicio:** resumen de los 3 módulos (última actividad de cada uno) en tarjetas, con acceso directo a cada sección. El muro de actividad detallado se pospone a Fase 2; en Fase 1 basta con mostrar 2-3 eventos recientes calculados directamente de las tablas de cada módulo (sin tabla `activity_feed` dedicada todavía).

## 8. Roadmap

- **Fase 1 (MVP):** todo lo descrito en este documento — auth, creación de space + invitación, y los 3 módulos completos.
- **Fase 2:** tabla `activity_feed` real y muro de actividad enriquecido, notificaciones/recordatorios.
- **Fase 3:** invitar a más de un miembro por space, tipos de space (pareja/familia/amigos), roles y permisos por módulo.
- **Fase 4:** app nativa (Expo/React Native reutilizando Supabase), estadísticas del space.

## 9. Mockups de referencia

Los mockups validados durante el brainstorming (navegación, Inicio, Viajes, Retos, Objetivos) quedan guardados en `.superpowers/brainstorm/934-1785176885/content/` como referencia visual del diseño aprobado.
