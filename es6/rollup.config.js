import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
//import babel from '@rollup/plugin-babel';

const extensions = [
    '.js'
];

export default [
    {
        input: './demo.js',
        output: [
            {
                name: 'FlowchartBuilder',
                file: './_build/demo.umd.js',
                format: 'umd'
            }
        ],
        plugins: [
            resolve({ extensions }),
            commonjs(),
           // babel({ extensions, include: ['**/*'] })
        ]
    }
];


