import type { ProcessedModel } from "../models";
import type { Endpoint } from "../endpoints/endpoints";
import type { Conversation } from "$lib/types/Conversation";
import type { Message } from "$lib/types/Message";
import type { Assistant } from "$lib/types/Assistant";

export interface TextGenerationContext {
	model: ProcessedModel;
	endpoint: Endpoint;
	conv: Conversation;
	messages: Message[];
	assistant_name?: string;
	assistant_description?: string;
	assistant_preprompt?: string;
	assistant?: Pick<Assistant, "rag" | "dynamicPrompt" | "generateSettings" | "tools" | "name" | "description" | "preprompt">;
	isContinue: boolean;
	webSearch: boolean;
	toolsPreference: Array<string>;
	promptedAt: Date;
	ip: string;
	username?: string;
}
