import LimitedArray from '../components/LimitedArray';

export default function resolveInput(type) {
	const { name, options } = type;

	if (
		name === 'array' &&
		options &&
		(options.hasOwnProperty('limit') ||
			options.hasOwnProperty('typeLimits'))
	) {
		return LimitedArray;
	}
}
