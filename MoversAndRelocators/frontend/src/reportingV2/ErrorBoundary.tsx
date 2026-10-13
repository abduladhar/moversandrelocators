import {Component,type ReactNode} from 'react'
import {Alert,Button} from 'antd'
import {t} from '../i18n'

/** Catches render errors in a subtree and shows them, instead of React unmounting the whole page. */
export class ErrorBoundary extends Component<{children:ReactNode;title:string;onReset?:()=>void;resetLabel?:string},{error:Error|null}>{
 state={error:null as Error|null}
 static getDerivedStateFromError(error:Error){return {error}}
 componentDidCatch(error:Error){console.error(error)}
 render(){
  if(!this.state.error)return this.props.children
  return <div style={{padding:24}}><Alert type="error" showIcon title={this.props.title} description={this.state.error.message}
   action={this.props.onReset&&<Button size="small" onClick={()=>{this.setState({error:null});this.props.onReset?.()}}>{this.props.resetLabel??t('common.back')}</Button>}/></div>
 }
}
