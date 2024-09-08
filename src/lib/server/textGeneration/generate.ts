import { performance } from 'perf_hooks';
import type { ToolResult } from "$lib/types/Tool";
import { MessageUpdateType, type MessageUpdate } from "$lib/types/MessageUpdate";
import { AbortedGenerations } from "../abortedGenerations";
import type { TextGenerationContext } from "./types";
import type { EndpointMessage } from "../endpoints/endpoints";
import type { TextGenerationOutput } from "@huggingface/inference";


type GenerateContext = Omit<TextGenerationContext, "messages"> & { messages: EndpointMessage[] };

export async function* generate(
    { model, endpoint, conv, messages, assistant, isContinue, promptedAt }: GenerateContext,
    toolResults: ToolResult[],
    preprompt?: string
): AsyncIterable<MessageUpdate> {
    const startTime = performance.now();
    console.log('generate(): Starting generate function');
    console.log('generate(): assistant = ', assistant);
    console.log('generate(): endpoint = ', endpoint);
    console.log('generate(): preprompt = ', preprompt);

    let tokenCount = 0;
    let lastYieldTime = startTime;

    try {
        const endpointStartTime = performance.now();
        const endpointResponse = await endpoint({
            messages,
            preprompt: preprompt,
            continueMessage: isContinue,
            generateSettings: assistant?.generateSettings,
            toolResults,
            assistant_name: assistant?.name,
            assistant_description: assistant?.description,
            assistant_preprompt: assistant?.preprompt,
        });

        //console.log(`Endpoint initialization took ${performance.now() - endpointStartTime}ms`);
        if (Symbol.asyncIterator in endpointResponse) {
            for await (const output of endpointResponse) {
                console.log('generate(): output = ', output);
                const iterationStartTime = performance.now();

                if (output.generated_text) {
                    //console.log(`Final text generation took ${performance.now() - iterationStartTime}ms`);

                    let interrupted = !output.token.special && !model.parameters.stop?.includes(output.token.text);

                    let text = output.generated_text.trimEnd();
                    for (const stopToken of model.parameters.stop ?? []) {
                        if (!text.endsWith(stopToken)) continue;

                        interrupted = false;
                        text = text.slice(0, text.length - stopToken.length);
                    }

                    const yieldStartTime = performance.now();
                    yield { type: MessageUpdateType.FinalAnswer, text, interrupted };
                    //console.log(`Yielding final answer took ${performance.now() - yieldStartTime}ms`);
                    continue;
                }

                if (output.token.special) {
                    console.log('Skipping special token');
                    continue;
                }

                tokenCount++;
                const currentTime = performance.now();
                //console.log(`Processing token ${tokenCount} took ${currentTime - iterationStartTime}ms`);

                const yieldStartTime = performance.now();
                yield { type: MessageUpdateType.Stream, token: output.token.text };
                //console.log(`Yielding token took ${performance.now() - yieldStartTime}ms`);
                //console.log(`Time since last yield: ${currentTime - lastYieldTime}ms`);
                lastYieldTime = currentTime;

                const date = AbortedGenerations.getInstance().getList().get(conv._id.toString());
                if (date && date > promptedAt) {
                    console.log('Generation aborted');
                    break;
                }

                if (!output) {
                    console.log('No output, breaking');
                    break;
                }
            }
        } else {
            //console.log('endpointResponse is not an async iterator');
            // Non-streaming response
            const output = endpointResponse as TextGenerationOutput;
            console.log('generate(): non-streaming output = ', output);

            let text = output.generated_text.trimEnd();
            for (const stopToken of model.parameters.stop ?? []) {
                if (!text.endsWith(stopToken)) continue;
                text = text.slice(0, text.length - stopToken.length);
            }

            yield { type: MessageUpdateType.FinalAnswer, text, interrupted: false };
        }
    } catch (error) {
        console.error('Error in generate function:', error);
        throw error;
    } finally {
        //console.log(`Total generate execution took ${performance.now() - startTime}ms`);
        //console.log(`Total tokens processed: ${tokenCount}`);
        console.log(`Generate function execution took ${performance.now() - startTime}ms`);
    }
}