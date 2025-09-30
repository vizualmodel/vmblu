// ------------------------------------------------------------------
// MCP tool file for model: 
// Creation date 6/27/2025, 4:40:26 PM
// ------------------------------------------------------------------

export const mcpTools = [
    {
        name: 'camera manager_camera add',
        description: 'Trigger camera add on camera manager',
        parameters: [
            {
                name: 'name',
                type: 'string',
                description: '- the name of the camera.'
            },
            {
                name: 'type',
                type: 'CameraType',
                description: '- perspective or orthographic'
            },
            {
                name: 'near',
                type: 'number',
                description: '- New near clipping plane distance.'
            },
            {
                name: 'far',
                type: 'number',
                description: '- New far clipping plane distance.'
            },
            {
                name: 'fov',
                type: 'number',
                description: '- New field of view angle.'
            },
            {
                name: 'zoom',
                type: 'number',
                description: '- New zoom factor.'
            },
            {
                name: 'aspect',
                type: 'number',
                description: '- New aspect ratio.'
            },
            {
                name: 'position',
                type: 'import(three).Vector3',
                description: '- position of the camera'
            },
            {
                name: 'lookAt',
                type: 'import(three).Vector3',
                description: '- point that the camera looks at'
            }
        ],
        returns: '',
        node: 'camera manager',
        pin: 'camera add',
        handler: 'onCameraAdd',
        file: 'C:/dev/vm/app/solar/src/3d/camera-manager.js',
        line: 156
    },
    {
        name: 'camera manager_camera update',
        description: 'Trigger camera update on camera manager',
        parameters: [
            {
                name: 'near',
                type: 'number',
                description: '- New near clipping plane distance.'
            },
            {
                name: 'far',
                type: 'number',
                description: '- New far clipping plane distance.'
            },
            {
                name: 'fov',
                type: 'number',
                description: '- New field of view angle.'
            },
            {
                name: 'zoom',
                type: 'number',
                description: '- New zoom factor.'
            },
            {
                name: 'aspect',
                type: 'number',
                description: '- New aspect ratio.'
            }
        ],
        returns: '',
        node: 'camera manager',
        pin: 'camera update',
        handler: 'onCameraUpdate',
        file: 'C:/dev/vm/app/solar/src/3d/camera-manager.js',
        line: 192
    },
    {
        name: 'camera manager_get camera',
        description: 'Trigger get camera on camera manager',
        parameters: [
            {
                name: 'definition',
                type: 'CameraDefinition',
                description: '- Definition of the camera.'
            },
            {
                name: 'location',
                type: '@param {import(three).Vector3} location.position - Position vector of the camera.\r\n\t * @param {import(three).Vector3} location.lookAt - LookAt vector of the camera.\r\n     * ',
                description: '- Location with position and lookAt vectors.'
            },
            {
                name: 'controls',
                type: 'ControlType',
                description: '- Controls type for the camera.'
            }
        ],
        returns: '',
        node: 'camera manager',
        pin: 'get camera',
        handler: 'onGetCamera',
        file: 'C:/dev/vm/app/solar/src/3d/camera-manager.js',
        line: 264
    }
]