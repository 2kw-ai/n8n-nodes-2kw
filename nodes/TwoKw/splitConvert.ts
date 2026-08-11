import { IDataObject, INodeExecutionData } from 'n8n-workflow';

interface ConvertResponseShape {
	status?: string;
	processingTime?: number;
	timings?: unknown;
	documents?: Record<string, unknown>[];
	errors?: Record<string, unknown>[];
}

export function splitConvertResponse(
	response: ConvertResponseShape,
	itemIndex: number,
): INodeExecutionData[] {
	const meta = {
		status: response.status,
		processingTime: response.processingTime,
		timings: response.timings,
	};
	const docItems: INodeExecutionData[] = (response.documents ?? []).map((doc) => ({
		json: { ...doc, _response: meta } as IDataObject,
		pairedItem: itemIndex,
	}));
	const errorItems: INodeExecutionData[] = (response.errors ?? []).map((err) => ({
		json: { ...err, _response: { ...meta, error: true } } as IDataObject,
		pairedItem: itemIndex,
	}));
	return [...docItems, ...errorItems];
}
