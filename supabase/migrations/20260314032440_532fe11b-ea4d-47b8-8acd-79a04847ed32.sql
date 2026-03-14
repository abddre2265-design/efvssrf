
CREATE TABLE public.ai_chat_histories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (organization_id)
);

ALTER TABLE public.ai_chat_histories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org chat history"
  ON public.ai_chat_histories FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM organizations
    WHERE organizations.id = ai_chat_histories.organization_id
    AND organizations.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert their org chat history"
  ON public.ai_chat_histories FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM organizations
    WHERE organizations.id = ai_chat_histories.organization_id
    AND organizations.user_id = auth.uid()
  ));

CREATE POLICY "Users can update their org chat history"
  ON public.ai_chat_histories FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM organizations
    WHERE organizations.id = ai_chat_histories.organization_id
    AND organizations.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete their org chat history"
  ON public.ai_chat_histories FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM organizations
    WHERE organizations.id = ai_chat_histories.organization_id
    AND organizations.user_id = auth.uid()
  ));
