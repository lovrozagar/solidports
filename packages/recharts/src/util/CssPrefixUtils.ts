const PREFIX_LIST = ["Webkit", "Moz", "O", "ms"]

export const generatePrefixStyle = (name: string, value: string) => {
	if (!name) {
		return undefined
	}

	const camelName = name.replace(/(\w)/, (v) => v.toUpperCase())
	const result: Record<string, string> = PREFIX_LIST.reduce(
		(res: Record<string, string>, entry) => {
			res[entry + camelName] = value
			return res
		},
		{},
	)

	result[name] = value

	return result
}
