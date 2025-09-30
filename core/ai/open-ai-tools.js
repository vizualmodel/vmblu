export const Tools = {

    // The transmitter
    tx: null,

    // The first message on the chat
    systemMessage : {
        role: 'system',
        content: "You are an assistant inside a solar system simulator. The unit length in this simulator is 1 AU. "
    },

    // The tool specifications
    specs : [
        {
            type: 'function',
            function: {
                name: 'place_camera',
                description: 'Define a camera and place it on a planet at the given coordinates.',
                parameters: {
                    type: 'object',
                    properties: {
                        camera: { 
                            type: 'object',
                            properties: {
                                name: { type: 'string', description: 'The name of the camera. Give a meaningful name.' },
                                type: { type: 'string', description: 'The type of camera (e.g., perspective, orthographic).' },
                                fov: { type: 'number', description: 'The field of view in degrees.' },
                                aspect: { type: 'string', description: 'The aspect ratio (e.g., canvas, 4:3, 16:9).' },
                                zoom: { type: 'number', description: 'The zoom factor for the camera. Default is 1' },
                                far: { type: 'number', description: 'The far clipping plane. Set it at 10AU unless specifically specified' },
                                near: { type: 'number', description: 'The near clipping plane. Set it at 0.000001 AU, unless specifically specified.' }
                            }
                        },
                        planet: { type: 'string', description: 'The planet where the camera is placed (e.g., mars).' },
                        coordinates: { type: 'string', description: 'The coordinates on the planet as a string: 50°53\'10.7"N 3°45\'57.9"E ' },
                    },
                    required: ['camera', 'planet', 'coordinates'],
                }
            }
        }
    ],

    // The function to call when the tool is used    
    place_camera({planet, coordinates, camera}){

        const {name, type, fov, aspect, zoom, near, far} = camera;

        //console.log('get_camera', camera);

        this.tx.wireless('camera manager').request('get.camera', {definition:camera, controls:'telescope'})
        .then(newCamera => {

            //console.log('received camera', newCamera);

            this.tx.wireless(planet).send('place local camera', {planet, coordinates, camera:newCamera})
        })
    }
}
