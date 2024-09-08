import { z } from "zod";
import { performance } from 'perf_hooks';
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
import type { TextGenerationOutput } from "@huggingface/inference";



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
    assistant_name: z.string().optional(),
    assistant_description: z.string().optional(),
    assistant_preprompt: z.string().optional(),
    assistant: z.object({
        rag: z.boolean().optional(),
        dynamicPrompt: z.boolean().optional(),
        generateSettings: z.record(z.any()).optional(),
        tools: z.array(z.string()).optional(),
        name: z.string().optional(),
        description: z.string().optional(),
        preprompt: z.string().optional(),
        character: z.string().optional(), // Added this field
        _id: z.string().optional(),
        createdById: z.string().optional(),
        modelId: z.string().optional(),
        createdAt: z.date().optional(),
        updatedAt: z.date().optional(),
        exampleInputs: z.array(z.any()).optional(),
        searchTokens: z.array(z.string()).optional(),
        last24HoursCount: z.number().optional(),
    }).optional(),
});


import { performance } from 'perf_hooks';

export async function endpointOai(
    input: z.input<typeof endpointOAIParametersSchema>
): Promise<Endpoint> {
    const startTime = performance.now();
    console.log('endpointOai(): Starting endpointOai function with input:', input);
    
    try {
        const parseStartTime = performance.now();
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
            assistant,
            assistant_name,
            assistant_description,
            assistant_preprompt,
        } = endpointOAIParametersSchema.parse(input);

        console.log('Making request to OpenAI');
        console.log('baseURL:', baseURL);
        console.log('completion:', completion);
        console.log('model:', model);
        console.log('defaultHeaders:', defaultHeaders);
        console.log('defaultQuery:', defaultQuery);
        console.log('multimodal:', multimodal);
        console.log('extraBody:', extraBody);
        console.log('stream:', stream);
        console.log('assistant:', assistant);
        console.log('assistant_name:', assistant_name);
        console.log('assistant_description:', assistant_description);
        console.log('assistant_preprompt:', assistant_preprompt);
        console.log(`Input parsing took ${performance.now() - parseStartTime}ms`);

        const importStartTime = performance.now();
        let OpenAI;
        try {
            OpenAI = (await import("openai")).OpenAI;
            console.log(`OpenAI import took ${performance.now() - importStartTime}ms`);
        } catch (e) {
            console.error('Failed to import OpenAI:', e);
            throw new Error("Failed to import OpenAI", { cause: e });
        }

        const clientInitStartTime = performance.now();
        const openai = new OpenAI({
            apiKey: apiKey ?? "sk-",
            baseURL,
            defaultHeaders,
            defaultQuery,
        });
        console.log(`OpenAI client initialization took ${performance.now() - clientInitStartTime}ms`);

        const imageProcessorStartTime = performance.now();
        const imageProcessor = makeImageProcessor(multimodal.image);
        console.log(`Image processor initialization took ${performance.now() - imageProcessorStartTime}ms`);

        if (completion === "chat_completions") {
            return async ({ messages, preprompt, generateSettings }) => {
                const prepareMessagesStartTime = performance.now();
                let messagesOpenAI = await prepareMessages(messages, imageProcessor, assistant);
                console.log(`Preparing messages took ${performance.now() - prepareMessagesStartTime}ms`);

                if (messagesOpenAI?.[0]?.role !== "system") {
                    messagesOpenAI = [{ role: "system", content: "" }, ...messagesOpenAI];
                }

                if (messagesOpenAI?.[0]) {
                    messagesOpenAI[0].content = preprompt ?? "";
                }

                const parameters = { 
                    ...model.parameters, 
                    ...generateSettings,
                    ...assistant?.generateSettings // Merge assistant settings
                };

                const body = {
                    character: assistant?.name,
                    model: model.id ?? model.name,
                    messages: messagesOpenAI,
                    stream: false,
                    max_tokens: parameters?.max_new_tokens,
                    stop: parameters?.stop,
                    temperature: parameters?.temperature,
                    top_p: parameters?.top_p,
                    frequency_penalty: parameters?.repetition_penalty,
                    assistant_name,
                    assistant_description,
                    assistant_preprompt,
                };

                try {
                    const apiCallStartTime = performance.now();
                    if (stream) {
                        const openChatAICompletion = await openai.chat.completions.create(body as ChatCompletionCreateParamsStreaming);
                        console.log(`Streaming API call took ${performance.now() - apiCallStartTime}ms`);
                        return openAIChatToTextGenerationStream(openChatAICompletion);
                    } else {
                        const openChatAICompletion = await openai.chat.completions.create(body as ChatCompletionCreateParamsNonStreaming);
                        console.log(`Non-streaming API call took ${performance.now() - apiCallStartTime}ms`);
                        

                        // Prepare and return the response object directly
                        const responseObject: TextGenerationOutput = {
                            generated_text: openChatAICompletion.choices[0]?.message.content ?? "",
                            details: null
                        };

                        console.log(`Response object created at ${performance.now()}ms`);
                        return responseObject;
                        //return async function* (): AsyncGenerator<TextGenerationStreamOutput> {
                        //    const yieldStartTime = performance.now();
                        //   yield {
                        //        token: {
                        //            id: 0,
                        //            text: openChatAICompletion.choices[0]?.message.content ?? "",
                        //            logprob: 0,
                        //            special: false,
                        //        },
                        //        generated_text: openChatAICompletion.choices[0]?.message.content ?? "",
                        //        details: null,
                        //    };
                        //    console.log(`Yielding response took ${performance.now() - yieldStartTime}ms`);
                        //}();
                    }
                } catch (error) {
                    console.error('Error in OpenAI chat completions API call:', error);
                    throw error;
                }
            };
        } else {
            console.error('Invalid completion type:', completion);
            throw new Error("Invalid completion type");
        }
    } catch (error) {
        console.error('Error in endpointOai function:', error);
        throw error;
    } finally {
        console.log(`Total endpointOai execution took ${performance.now() - startTime}ms`);
    }
}

async function prepareMessages(
	messages: EndpointMessage[],
	imageProcessor: ReturnType<typeof makeImageProcessor>,
    assistant?: z.infer<typeof endpointOAIParametersSchema>['assistant']
): Promise<OpenAI.Chat.Completions.ChatCompletionMessageParam[]> {
	return Promise.all(
		messages.map(async (message) => {
			if (message.from === "user") {

                let content = message.content;
                
				return {
					role: message.from,
					content: [
						...(await prepareFiles(imageProcessor, message.files ?? [])),
						{ type: "text", text: message.content },
					],
				};
			}
            if (message.from === "assistant" && assistant?.rag) {
                // Handle RAG-specific logic here
                // For example, you might want to add citations or modify the content
                return {
                    role: message.from,
                    content: `[RAG-enhanced] ${message.content}`,
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
