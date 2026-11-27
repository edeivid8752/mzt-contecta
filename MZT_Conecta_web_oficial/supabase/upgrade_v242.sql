BEGIN;
ALTER TABLE public.mzt_forum_threads DROP CONSTRAINT mzt_forum_threads_category_check;
ALTER TABLE public.mzt_forum_threads ADD CONSTRAINT mzt_forum_threads_category_check CHECK (category IN ('Infraestructura','Qué hacer','Ideas para Mazatlán','Playas','Comunidad','Movilidad','Otros'));
COMMIT;
