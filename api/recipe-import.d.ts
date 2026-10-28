export interface RecipeImportRequest {
  method?: string;
  body?: { url?: string };
}

export interface RecipeImportResponse {
  status(code: number): RecipeImportResponse;
  setHeader(name: string, value: string): void;
  json(value: unknown): RecipeImportResponse;
  send(value: string): RecipeImportResponse;
}

export function createRecipeImportHandler(fetcher?: typeof fetch): (req: RecipeImportRequest, res: RecipeImportResponse) => Promise<unknown>;
