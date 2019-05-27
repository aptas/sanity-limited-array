# Sanity Limited Array

A fork of the default Sanity `array` type, with options for:

1. Limiting total items in array
2. Limit items of a given type in array

## Installation

Copy or merge the contents of `parts` and `components` into your own project
Add the following to the `parts` array in `sanity.json` :

```
{
    "implements": "part:@sanity/form-builder/input-resolver",
    "path": "./parts/inputResolver.js"
}
```

## Example Usage

```
{
    ...

    type: 'array',
    options: {
        limit: 5, // limit of 5 items in total
        typeLimits: {
            _default: 1, // max 1 of every type. if not set, Number.MAX_SAFE_INTEGER is used
            someType: 2, // overrides _default
        },

        OR

        typeLimits: 1, // can also be set to a number, indicating max 1 of every type
    },
    of: [
        {
            type: 'someType',
        },
        {
            type: 'otherType',
        },
        {
            type: 'thirdType',
        },
    ]
},
```
