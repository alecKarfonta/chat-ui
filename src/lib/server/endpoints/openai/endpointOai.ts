import { z } from "zod";
import { openAICompletionToTextGenerationStream } from "./openAICompletionToTextGenerationStream";
import { openAIChatToTextGenerationStream } from "./openAIChatToTextGenerationStream";
import type { CompletionCreateParamsStreaming, CompletionCreateParamsNonStreaming} from "openai/resources/completions";
import type { ChatCompletionCreateParamsStreaming, ChatCompletionCreateParamsNonStreaming } from "openai/resources/chat/completions";
import { buildPrompt } from "$lib/buildPrompt";
import { env } from "$env/dynamic/private";
import type { Endpoint } from "../endpoints";
import type OpenAI from "openai";
import { createImageProcessorOptionsValidator, makeImageProcessor } from "../images";
import type { MessageFile } from "$lib/types/Message";
import type { EndpointMessage } from "../endpoints";
import type { TextGenerationStreamOutput } from "@huggingface/inference";

export const endpointOAIParametersSchema = z.object({
	weight: z.number().int().positive().default(1),
	model: z.any(),
	type: z.literal("openai"),
	baseURL: z.string().url().default("https://api.openai.com/v1"),
	apiKey: z.string().default(env.OPENAI_API_KEY ?? "sk-"),
	completion: z
		.union([z.literal("completions"), z.literal("chat_completions")])
		.default("chat_completions"),
	defaultHeaders: z.record(z.string()).optional(),
	defaultQuery: z.record(z.string()).optional(),
	extraBody: z.record(z.any()).optional(),
	multimodal: z
		.object({
			image: createImageProcessorOptionsValidator({
				supportedMimeTypes: [
					"image/png",
					"image/jpeg",
					"image/webp",
					"image/avif",
					"image/tiff",
					"image/gif",
				],
				preferredMimeType: "image/webp",
				maxSizeInMB: Infinity,
				maxWidth: 4096,
				maxHeight: 4096,
			}),
		})
		.default({}),
	stream: z.boolean().default(false),
});


export async function endpointOai(
    input: z.input<typeof endpointOAIParametersSchema>
): Promise<Endpoint> {
    console.log('endpointOai(): Starting endpointOai function');
    console.log('endpointOai(): Input:', JSON.stringify(input, null, 2));

    try {
        const {
            baseURL,
            apiKey,
            completion,
            model,
            defaultHeaders,
            defaultQuery,
            multimodal,
            extraBody,
            stream,
        } = endpointOAIParametersSchema.parse(input);
        console.log('Input parsed successfully');

        let OpenAI;
        try {
            console.log('Attempting to import OpenAI');
            OpenAI = (await import("openai")).OpenAI;
            console.log('OpenAI imported successfully');
        } catch (e) {
            console.error('Failed to import OpenAI:', e);
            throw new Error("Failed to import OpenAI", { cause: e });
        }

        console.log('endpointOai(): Initializing OpenAI client');
        const openai = new OpenAI({
            apiKey: apiKey ?? "sk-",
            baseURL,
            defaultHeaders,
            defaultQuery,
        });
        console.log('endpointOai(): OpenAI client initialized');

        console.log('endpointOai(): Initializing image processor');
        const imageProcessor = makeImageProcessor(multimodal.image);
        console.log('endpointOai(): Image processor initialized');

        if (completion === "completions") {
            console.log('endpointOai(): Error: completions endpoint is not supported');
        } else if (completion === "chat_completions") {
            console.log('endpointOai(): Using chat completions endpoint');
            return async ({ messages, preprompt, generateSettings }) => {
                console.log('endpointOai(): Preparing messages');
                let messagesOpenAI: OpenAI.Chat.Completions.ChatCompletionMessageParam[] =
                    await prepareMessages(messages, imageProcessor);
                console.log('endpointOai(): Messages prepared:', messagesOpenAI);

                if (messagesOpenAI?.[0]?.role !== "system") {
                    console.log('Adding system message');
                    messagesOpenAI = [{ role: "system", content: "" }, ...messagesOpenAI];
                }

                if (messagesOpenAI?.[0]) {
                    console.log('Setting preprompt');
                    messagesOpenAI[0].content = preprompt ?? "";
                }

                const parameters = { ...model.parameters, ...generateSettings };
                console.log('endpointOai(): Parameters:', parameters);

                const body: CompletionCreateParamsStreaming | CompletionCreateParamsNonStreaming = {
                    model: model.id ?? model.name,
                    messages: messagesOpenAI,
                    stream: false,
                    max_tokens: parameters?.max_new_tokens,
                    stop: parameters?.stop,
                    temperature: parameters?.temperature,
                    top_p: parameters?.top_p,
                    frequency_penalty: parameters?.repetition_penalty,
                };
                console.log('Request body:', body);

                try {
                    console.log('endpointOai(): Sending request to OpenAI chat completions API');
                    if (stream) {
                        const openChatAICompletion = await openai.chat.completions.create(body as ChatCompletionCreateParamsStreaming);
                        console.log('endpointOai(): Received streaming response from OpenAI');
                        return openAIChatToTextGenerationStream(openChatAICompletion);
                    } else {
                        const openChatAICompletion = await openai.chat.completions.create(body as ChatCompletionCreateParamsNonStreaming);
                        console.log('endpointOai(): Received non-streaming response from OpenAI');
                        console.log('endpointOai(): openChatAICompletion:', openChatAICompletion);
                        return async function* (): AsyncGenerator<TextGenerationStreamOutput> {
                            yield {
                                token: {
                                    id: 0,
                                    text: openChatAICompletion.choices[0]?.message.content ?? "",
                                    logprob: 0,
                                    special: false,
                                },
                                generated_text: openChatAICompletion.choices[0]?.message.content ?? "",
                                details: null,
                            };
                        }();
                    }
                } catch (error) {
                    console.error('endpointOai(): Error in OpenAI chat completions API call:', error);
                    throw error;
                }
            };
        } else {
            console.error('endpointOai(): Invalid completion type:', completion);
            throw new Error("Invalid completion type");
        }
    } catch (error) {
        console.error('endpointOai(): Error in endpointOai function:', error);
        throw error;
    }
}

async function prepareMessages(
	messages: EndpointMessage[],
	imageProcessor: ReturnType<typeof makeImageProcessor>
): Promise<OpenAI.Chat.Completions.ChatCompletionMessageParam[]> {
	return Promise.all(
		messages.map(async (message) => {
			if (message.from === "user") {
				return {
					role: message.from,
					content: [
						...(await prepareFiles(imageProcessor, message.files ?? [])),
						{ type: "text", text: message.content },
					],
				};
			}
			return {
				role: message.from,
				content: message.content,
			};
		})
	);
}

async function prepareFiles(
	imageProcessor: ReturnType<typeof makeImageProcessor>,
	files: MessageFile[]
): Promise<OpenAI.Chat.Completions.ChatCompletionContentPartImage[]> {
	const processedFiles = await Promise.all(files.map(imageProcessor));
	return processedFiles.map((file) => ({
		type: "image_url" as const,
		image_url: {
			url: `data:${file.mime};base64,${file.image.toString("base64")}`,
		},
	}));
}
