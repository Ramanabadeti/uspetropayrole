import React, { useEffect, useState } from 'react';

function DateTime(){
    const [date, setDate] = useState(new Date());

    useEffect(()=>{
        const timer = setInterval(()=> setDate(new Date()), 1000);
        return ()=> clearInterval(timer);
    })

    return(
        <p>{date.toLocaleString()}</p>
    )

}

export default DateTime