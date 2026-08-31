-- Some legacy manager accounts are linked through profiles.venue_id without
-- an explicit manager_venues row. Allow those managers to save their venue
-- settings while preserving the ownership boundary.
DROP POLICY IF EXISTS manager_update_own_venues ON public.venues;

CREATE POLICY manager_update_own_venues
ON public.venues
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.manager_venues mv
    WHERE mv.venue_id = venues.id
      AND mv.manager_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.venue_id = venues.id
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.manager_venues mv
    WHERE mv.venue_id = venues.id
      AND mv.manager_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.venue_id = venues.id
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
  )
);
